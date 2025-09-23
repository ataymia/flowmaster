export interface Env {
  AUTH_BASE: string;            // e.g. https://allstar-auth.your-worker.workers.dev
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

function buildCookie(
  name: string,
  value: string,
  opts: { path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: SameSite; maxAge?: number } = {}
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  if (opts.secure ?? true) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

export function setCookie(h: Headers, name: string, value: string, opts?: { path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: SameSite; maxAge?: number }) {
  h.append("Set-Cookie", buildCookie(name, value, opts));
}
export function clearCookie(h: Headers, name: string, path = "/") {
  h.append("Set-Cookie", `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
}
export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("="));
  }
  return out;
}
export function getCookie(req: Request, name: string): string | null {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/* ---------- Set-Cookie forwarding ---------- */
function getSetCookieLines(src: Response | Headers): string[] {
  const any = src as any;
  if (typeof any?.headers?.getSetCookie === "function") {
    const arr = any.headers.getSetCookie() || [];
    if (arr.length) return arr;
  }
  const h = src instanceof Response ? src.headers : src;
  const lines: string[] = [];
  try {
    (h as any).forEach?.((v: string, k: string) => {
      if (k?.toLowerCase() === "set-cookie" && v) lines.push(v);
    });
  } catch {}
  if (!lines.length) {
    const single = h.get("set-cookie");
    if (single) return single.split(/,(?=[^;]+?=)/g).map(s => s.trim());
  }
  return lines;
}
export function forwardSetCookies(src: Response | Headers, dst: Headers) {
  for (const line of getSetCookieLines(src)) dst.append("Set-Cookie", line);
}
export function pickCookieFromSetCookie(src: Response | Headers, name: string): string | null {
  for (const line of getSetCookieLines(src)) {
    const [pair] = line.split(";", 1);
    if (!pair) continue;
    const [k, ...rest] = pair.split("=");
    if (k?.trim().toLowerCase() === name.toLowerCase()) return (rest.join("=") || "").trim();
  }
  return null;
}

/* ---------- Guards ---------- */
export function ensureAccess(request: Request) {
  const c = parseCookies(request);
  if (c["access_token"] || c["allstar_at"]) return { ok: true as const };
  return { ok: false as const, response: json({ error: "unauthorized" }, 401, { "cache-control": "no-store" }) };
}

/* ---------- Upstream ---------- */
export function upstream(env: Env, path: string, init?: RequestInit) {
  const url = path.startsWith("http") ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}

/** Bearer proxy (reads cookie -> Authorization header). */
export async function proxyWithAuth(req: Request, env: Env, path: string, init: RequestInit = {}) {
  const token = parseCookies(req)["allstar_at"] || parseCookies(req)["access_token"];
  if (!token) return json({ error: "unauthorized" }, 401);
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  if (req.headers.get("content-type") && !headers.has("content-type")) headers.set("content-type", req.headers.get("content-type")!);
  const up = await upstream(env, path, { method: req.method, body: req.body, headers, redirect: "manual" });
  const out = new Headers(); const ct = up.headers.get("content-type"); if (ct) out.set("content-type", ct);
  forwardSetCookies(up, out);
  return new Response(up.body, { status: up.status, headers: out });
}

/** Session proxy (forwards Cookie header). */
export async function proxyWithSession(req: Request, env: Env, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const cookie = req.headers.get("cookie"); if (cookie) headers.set("cookie", cookie);
  if (req.headers.get("content-type") && !headers.has("content-type")) headers.set("content-type", req.headers.get("content-type")!);
  const up = await upstream(env, path, { method: req.method, body: req.body, headers, redirect: "manual" });
  const out = new Headers(); const ct = up.headers.get("content-type"); if (ct) out.set("content-type", ct);
  forwardSetCookies(up, out);
  return new Response(up.body, { status: up.status, headers: out });
}
