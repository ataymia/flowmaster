export interface Env {
  AUTH_BASE: string;              // e.g. https://allstar-auth.ataymia.workers.dev
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
}

export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

type SameSite = "Lax" | "Strict" | "None";

export function getCookie(req: Request, name: string): string | null {
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setCookie(headers: Headers, name: string, value: string, opts: {
  maxAge?: number; path?: string; sameSite?: SameSite; secure?: boolean; httpOnly?: boolean; domain?: string;
} = {}) {
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
  headers.append("set-cookie", `${name}=; Max-Age=0; Path=${path}; SameSite=Lax; Secure; HttpOnly`);
}

export function getAllSetCookie(h: Headers): string[] {
  const anyH = h as any; if (typeof anyH.getAll === "function") return anyH.getAll("set-cookie") || [];
  const one = h.get("set-cookie"); return one ? [one] : [];
}
export function forwardSetCookies(from: Response | Headers, to: Headers) {
  const src = "headers" in from ? (from as Response).headers : (from as Headers);
  for (const v of getAllSetCookie(src)) to.append("set-cookie", v);
}
export function pickCookieFromSetCookie(src: Headers, name: string): string | null {
  for (const v of getAllSetCookie(src)) { const m = v.match(new RegExp(`(?:^|; )${name}=([^;]*)`)); if (m) return decodeURIComponent(m[1]); }
  return null;
}

export async function upstream(env: Env, path: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}
