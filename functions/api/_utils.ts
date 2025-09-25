// functions/api/_utils.ts
// Shared helpers for Pages Functions → Auth Worker proxying

export interface Env {
  // Your Worker base URL, e.g. "https://allstar-auth.ataymia.workers.dev"
  AUTH_BASE: string;

  // (used by /api/news widget; unchanged)
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

/* ---------------- Robust Set-Cookie forwarding ---------------- */

function getHeader(h: Headers, name: string): string | null {
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
  const headers = "headers" in from ? (from as Response).headers : (from as Headers);

  const flattened = getHeader(headers, "set-cookie");
  if (flattened) {
    const parts = flattened.split(/,(?=[^;=]+?=)/g);
    for (const p of parts) to.append("Set-Cookie", p.trim());
    return;
  }

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

function resolveBase(env: Env) {
  // Hard fallback so /whoami & login keep working during misconfig
  return (env as any)?.AUTH_BASE || "https://allstar-auth.ataymia.workers.dev";
}
export async function upstream(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const base = resolveBase(env);
  const url = path.startsWith("http") ? path : `${base}${path}`;
  return fetch(url, init);
}

/* ---------------- Session/Access checks ---------------- */

export function ensureSession(req: Request): { ok: true } | { ok: false; response: Response } {
  const access = getCookie(req, "access_token");
  const pageAT = getCookie(req, "allstar_at");
  if (access || pageAT) return { ok: true as const };
  return {
    ok: false as const,
    response: json({ error: "unauthorized" }, 401, { "cache-control": "no-store" }),
  };
}

export function ensureAccess(req: Request): { ok: true; token: string } | { ok: false; response: Response } {
  // Accept either site cookie (allstar_at) or worker cookie (access_token)
  const token = getCookie(req, "allstar_at") || getCookie(req, "access_token");
  if (!token) {
    return {
      ok: false as const,
      response: json({ error: "unauthorized" }, 401, { "cache-control": "no-store" }),
    };
  }
  return { ok: true as const, token };
}

/* ---------------- Proxies (ALWAYS forward cookie + bearer) ---------------- */

function buildAuthHeaders(req: Request, token: string, extra?: HeadersInit) {
  const headers = new Headers(extra || {});
  // Always send both auth forms; the Worker accepts either.
  headers.set("cookie", `access_token=${token}`);
  headers.set("authorization", `Bearer ${token}`);

  // Preserve JSON content-type if present on incoming request
  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  // Preserve Accept if present (some callers require it)
  const accept = req.headers.get("accept");
  if (accept && !headers.has("accept")) headers.set("accept", accept);

  return headers;
}

export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const access = ensureAccess(req);
  if (!access.ok) return access.response;

  const headers = buildAuthHeaders(req, access.token, init.headers);

  const res = await upstream(env, path, {
    ...init,
    method: init.method || req.method,
    body: init.body ?? req.body,
    headers,
    redirect: "manual",
  });

  const outHeaders = new Headers();
  const resCT = res.headers.get("content-type");
  if (resCT) outHeaders.set("content-type", resCT);
  forwardSetCookies(res, outHeaders);

  return new Response(res.body, { status: res.status, headers: outHeaders });
}

export async function proxyWithSession(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers || {});
  const cookie = req.headers.get("cookie");
  if (cookie && !headers.has("cookie")) headers.set("cookie", cookie);

  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  const accept = req.headers.get("accept");
  if (accept && !headers.has("accept")) headers.set("accept", accept);

  const res = await upstream(env, path, {
    ...init,
    method: init.method || req.method,
    body: init.body ?? req.body,
    headers,
    redirect: "manual",
  });

  const outHeaders = new Headers();
  const resCT = res.headers.get("content-type");
  if (resCT) outHeaders.set("content-type", resCT);
  forwardSetCookies(res, outHeaders);

  return new Response(res.body, { status: res.status, headers: outHeaders });
}

/* ---------------- Helpers ---------------- */

export async function safeJson<T = any>(res: Response): Promise<T | null> {
  try { return (await res.clone().json()) as T; } catch { return null; }
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
