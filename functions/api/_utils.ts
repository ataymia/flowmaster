// functions/api/_utils.ts

export interface Env {
  AUTH_BASE: string;            // e.g., https://allstar-auth.ataymia.workers.dev
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
  headers.append("set-cookie", parts.join("; "));
}

export function clearCookie(headers: Headers, name: string, path = "/") {
  headers.append(
    "set-cookie",
    `${name}=; Max-Age=0; Path=${path}; SameSite=Lax; Secure; HttpOnly`
  );
}

/* ---------------- Set-Cookie forwarding ---------------- */
export function getAllSetCookie(h: Headers): string[] {
  const anyH = h as any;
  if (typeof anyH.getAll === "function") return anyH.getAll("set-cookie") || [];
  const one = h.get("set-cookie");
  return one ? [one] : [];
}

export function forwardSetCookies(from: Response | Headers, to: Headers) {
  const src = "headers" in from ? (from as Response).headers : (from as Headers);
  for (const val of getAllSetCookie(src)) to.append("set-cookie", val);
}

export function pickCookieFromSetCookie(src: Headers, name: string): string | null {
  for (const v of getAllSetCookie(src)) {
    const m = v.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

/* ---------------- Upstream (Auth Worker) ---------------- */
export async function upstream(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const FALLBACK = "https://allstar-auth.ataymia.workers.dev";
  const base = (env as any)?.AUTH_BASE || FALLBACK;
  const url = path.startsWith("http") ? path : `${base}${path}`;
  return fetch(url, init);
}

/* ---------------- Session/Access checks (shape matches working zip) ---------------- */

/** Lightweight check used by some routes to gate access. */
export function ensureSession(req: Request): { ok: true } | { ok: false; response: Response } {
  const access = getCookie(req, "access_token");
  const pageAT = getCookie(req, "allstar_at");
  if (access || pageAT) return { ok: true as const };
  return { ok: false as const, response: json({ error: "unauthorized" }, 401, { "cache-control": "no-store" }) };
}

/** Stronger check used by /users and similar routes in the working repo. */
export function ensureAccess(req: Request): { ok: true; token: string } | { ok: false; response: Response } {
  const token =
    getCookie(req, "allstar_at") ||
    getCookie(req, "access_token");
  if (!token) return { ok: false as const, response: json({ error: "unauthorized" }, 401, { "cache-control": "no-store" }) };
  return { ok: true as const, token };
}

/* ---------------- Proxies ---------------- */

/** Proxy requiring a valid session; sends token as cookie to the worker. */
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const access = ensureAccess(req);
  if (!access.ok) return access.response;

  const headers = new Headers(init.headers || {});
  headers.set("cookie", `access_token=${access.token}`);

  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

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

/** Proxy that forwards the caller’s entire Cookie header (non-enforcing). */
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

/* ---------------- Utilities ---------------- */
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
