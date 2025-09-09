// functions/api/_utils.ts
export interface Env {
  AUTH_BASE: string;
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
}

/* ---------- JSON ---------- */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

/* ---------- Cookies ---------- */
type SameSite = "Lax" | "Strict" | "None";

export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  opts: { path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: SameSite; maxAge?: number } = {}
) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  headers.append("Set-Cookie", parts.join("; "));
}

export function clearCookie(headers: Headers, name: string, path = "/") {
  headers.append(
    "Set-Cookie",
    `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  );
}

export function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  // robust match (cookie-name=...)
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Split Cloudflare's possibly-combined Set-Cookie header and append all to outHeaders */
export function forwardSetCookies(src: Response | Headers, outHeaders: Headers) {
  const h = (src as any).headers ? (src as Response).headers : (src as Headers);
  const all = h.get("set-cookie");
  if (!all) return;
  // multiple cookies may be joined by commas—split when we see next cookie pattern "name="
  const parts = all.split(/,(?=[^;=]+=[^;]+)/g);
  for (const p of parts) outHeaders.append("Set-Cookie", p.trim());
}

/** Return just the cookie VALUE from an upstream Set-Cookie for cookieName */
export function pickCookieFromSetCookie(h: Headers, cookieName: string): string | null {
  const all = h.get("set-cookie");
  if (!all) return null;
  const parts = all.split(/,(?=[^;=]+=[^;]+)/g);
  for (const p of parts) {
    const first = p.split(";", 1)[0] || "";
    const [k, ...v] = first.split("=");
    if (k?.trim().toLowerCase() === cookieName.toLowerCase()) return v.join("=");
  }
  return null;
}

/* ---------- Access control ---------- */
export function ensureAccess(req: Request) {
  const at = getCookie(req, "allstar_at") || getCookie(req, "access_token");
  if (at) return { ok: true as const, token: at };
  return { ok: false as const, response: json({ error: "unauthorized" }, 401) };
}

/* ---------- Upstream ---------- */
export function upstream(env: Env, path: string, init?: RequestInit) {
  const url = path.startsWith("http") ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}
