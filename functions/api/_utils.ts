// functions/api/_utils.ts

export interface Env {
  AUTH_BASE: string;              // e.g. https://allstar-auth.ataymia.workers.dev
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
export async function upstream(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  // Fallback so login works even if AUTH_BASE isn’t configured yet
  const FALLBACK = "https://allstar-auth.ataymia.workers.dev";
  const base = (env && (env as any).AUTH_BASE) ? (env as any).AUTH_BASE : FALLBACK;
  const url = path.startsWith("http") ? path : `${base}${path}`;
  return fetch(url, init);
}

/* ---------------- Access enforcement ---------------- */
/**
 * Returns an access token from first-party cookies, or throws a 401 Response.
 * (Several existing routes import this.)
 */
export function ensureAccess(req: Request): string {
  const token =
    getCookie(req, "allstar_at") ||
    getCookie(req, "access_token");
  if (!token) {
    throw json({ error: "unauthorized" }, 401, { "cache-control": "no-store" });
  }
  return token;
}

/* ---------------- Proxies ---------------- */
/**
 * Proxy to the Auth Worker *requiring* a valid session.
 * (Matches existing imports `proxyWithAuth`.)
 */
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const token = ensureAccess(req); // throws 401 if missing
  const headers = new Headers(init.headers || {});
  headers.set("cookie", `access_token=${token}`);

  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  const up = await upstream(env, path, {
    ...init,
    method: init.method || req.method,
    body: init.body ?? req.body,
    headers,
    redirect: "manual",
  });

  const out = new Headers();
  const upCT = up.headers.get("content-type");
  if (upCT) out.set("content-type", upCT);
  forwardSetCookies(up, out);

  return new Response(up.body, { status: up.status, headers: out });
}

/**
 * Proxy that forwards the caller’s entire Cookie header (non-enforcing).
 * (Kept for compatibility if any route uses it.)
 */
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

  const up = await upstream(env, path, {
    ...init,
    method: init.method || req.method,
    body: init.body ?? req.body,
    headers,
    redirect: "manual",
  });

  const out = new Headers();
  const upCT = up.headers.get("content-type");
  if (upCT) out.set("content-type", upCT);
  forwardSetCookies(up, out);

  return new Response(up.body, { status: up.status, headers: out });
}
