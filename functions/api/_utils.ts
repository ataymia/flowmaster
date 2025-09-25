// functions/api/_utils.ts

export interface Env {
  /** Preferred: Worker origin, e.g. https://allstar-auth.ataymia.workers.dev */
  AUTH_BASE?: string;
  /** Back-compat / alias: if present, we’ll use this too */
  BACKEND_ORIGIN?: string;

  // for News widget (unchanged)
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
}

/* ---------------- JSON ---------------- */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

/* ---------------- Cookies ---------------- */
type SameSite = "Lax" | "Strict" | "None";

export function getCookie(req: Request, name: string): string | null {
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  opts: {
    maxAge?: number;
    path?: string;
    sameSite?: SameSite;
    secure?: boolean;
    httpOnly?: boolean;
    domain?: string;
  } = {}
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure ?? true) parts.push("Secure");
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  headers.append("Set-Cookie", parts.join("; "));
}

export function clearCookie(headers: Headers, name: string, path = "/") {
  headers.append(
    "Set-Cookie",
    `${name}=; Max-Age=0; Path=${path}; SameSite=Lax; Secure; HttpOnly`
  );
}

/* ---------------- Robust Set-Cookie forwarding (matches working zip behavior) ---------------- */

function getHeader(h: Headers, name: string): string | null {
  // getAll isn't always available in CF Pages runtime
  try {
    const anyH = h as any;
    if (typeof anyH.getAll === "function") {
      const vals = anyH.getAll(name);
      if (vals && vals.length) return vals.join(", ");
    }
  } catch {}
  return h.get(name) || null;
}

/**
 * Cloudflare often flattens multiple Set-Cookie values into a single header string.
 * This splits correctly on commas that start a new cookie (",<token>=").
 */
export function forwardSetCookies(from: Response | Headers, to: Headers) {
  const headers =
    "headers" in from ? (from as Response).headers : (from as Headers);

  const flattened = getHeader(headers, "set-cookie");
  if (flattened) {
    // split on comma that starts a new cookie
    const parts = flattened.split(/,(?=[^;=]+?=)/g);
    for (const p of parts) to.append("Set-Cookie", p.trim());
    return;
  }

  // Fallback: iterate (some runtimes keep multiple entries)
  try {
    (headers as any).forEach?.((val: string, key: string) => {
      if (key && key.toLowerCase() === "set-cookie" && val) {
        to.append("Set-Cookie", val);
      }
    });
  } catch {}
}

export function pickCookieFromSetCookie(src: Headers, name: string): string | null {
  const flattened = getHeader(src, "set-cookie");
  if (flattened) {
    const parts = flattened.split(/,(?=[^;=]+?=)/g);
    for (const v of parts) {
      const m = v.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
      if (m) return decodeURIComponent(m[1]);
    }
  }
  return null;
}

/* ---------------- Upstream (Auth Worker) ---------------- */

/**
 * Resolve the upstream origin.
 * Priority: AUTH_BASE → BACKEND_ORIGIN → FALLBACK
 * If we fall back, we add an X-Proxy-Fallback header so it’s visible in DevTools.
 */
function resolveAuthBase(env: Env): { base: string; fellBack: boolean } {
  const configured =
    (env.AUTH_BASE || env.BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");
  if (configured) return { base: configured, fellBack: false };

  // Hard fallback to keep Hub usable if variable is briefly missing.
  const FALLBACK = "https://allstar-auth.ataymia.workers.dev";
  return { base: FALLBACK, fellBack: true };
}

/**
 * Low-level upstream fetch (no cookie handling).
 * Prefer using proxyWithAuth / proxyWithSession / forward.
 */
export async function upstream(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const { base } = resolveAuthBase(env);
  const url = path.startsWith("http") ? path : `${base}${path}`;
  return fetch(url, init);
}

/* ---------------- Session/Access checks (contract matches working zip) ---------------- */

/** Lightweight check used to gate News etc. */
export function ensureSession(
  req: Request
): { ok: true } | { ok: false; response: Response } {
  const access = getCookie(req, "access_token");
  const pageAT = getCookie(req, "allstar_at");
  if (access || pageAT) return { ok: true as const };
  return {
    ok: false as const,
    response: json(
      { error: "unauthorized" },
      401,
      { "cache-control": "no-store" }
    ),
  };
}

export function ensureAccess(req: Request) {
  const token = getCookie(req, "access_token") || getCookie(req, "allstar_at");
  if (!token) return { ok: false as const, response: json({ error: "unauthorized" }, 401) };
  return { ok: true as const, token };
}

/* ---------------- Proxies ---------------- */

/**
 * Generic forwarder (keep original cookies/authorization).
 * Useful when you just want /api/* → Worker/* with minimal ceremony.
 */
export async function forward(env: Env, req: Request, path: string) {
  const { base, fellBack } = resolveAuthBase(env);
  const url = new URL(req.url);
  const target = `${base}${path}${url.search || ""}`;

  const headers = new Headers();
  // Pass browser cookies and/or Authorization header through to Worker
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth) headers.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = await req.clone().text();
  }

  const res = await fetch(target, init);
  const outHeaders = new Headers(res.headers);

  // mark fallback usage to help diagnose misconfig
  if (fellBack) outHeaders.set("x-proxy-fallback", "true");

  // Preserve Set-Cookie correctly
  const final = new Response(res.body, { status: res.status, headers: outHeaders });
  return final;
}

/**
 * Proxy that asserts session and injects access_token as Cookie explicitly.
 * Use for routes that require a clean, explicit cookie.
 */
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const access = ensureAccess(req);
  if (!access.ok) return access.response;

  const { base, fellBack } = resolveAuthBase(env);
  const url = new URL(req.url);
  const target = `${base}${path}${url.search || ""}`;

  const headers = new Headers(init.headers || {});
  headers.set("cookie", `access_token=${access.token}`);
  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  const res = await fetch(target, {
    ...init,
    method: init.method || req.method,
    body: init.body ?? req.body,
    headers,
    redirect: "manual",
  });

  const outHeaders = new Headers();
  const resCT = res.headers.get("content-type");
  if (resCT) outHeaders.set("content-type", resCT);
  if (fellBack) outHeaders.set("x-proxy-fallback", "true");
  forwardSetCookies(res, outHeaders);
  return new Response(res.body, { status: res.status, headers: outHeaders });
}

/**
 * Proxy that just forwards the session (browser cookies) as-is.
 * Use for routes like /auth/login, /me where Worker already handles cookies.
 */
export async function proxyWithSession(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const { base, fellBack } = resolveAuthBase(env);
  const url = new URL(req.url);
  const target = `${base}${path}${url.search || ""}`;

  const headers = new Headers(init.headers || {});
  const cookie = req.headers.get("cookie");
  if (cookie && !headers.has("cookie")) headers.set("cookie", cookie);
  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  const res = await fetch(target, {
    ...init,
    method: init.method || req.method,
    body: init.body ?? req.body,
    headers,
    redirect: "manual",
  });

  const outHeaders = new Headers();
  const resCT = res.headers.get("content-type");
  if (resCT) outHeaders.set("content-type", resCT);
  if (fellBack) outHeaders.set("x-proxy-fallback", "true");
  forwardSetCookies(res, outHeaders);
  return new Response(res.body, { status: res.status, headers: outHeaders });
}

/* ---------------- Helpers ---------------- */
export async function safeJson<T = any>(res: Response): Promise<T | null> {
  try {
    return (await res.clone().json()) as T;
  } catch {
    return null;
  }
}

export function parseCookieHeader(h: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}
