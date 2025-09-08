// Shared helpers for Pages Functions (Cloudflare Workers runtime)
export interface Env {
  AUTH_BASE: string;              // e.g. https://allstar-auth.ataymia.workers.dev
  NOTION_SECRET?: string;         // Notion internal integration token
  NOTION_DATABASE_ID?: string;    // Team Billboard database id
}

export function json(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers || {});
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers: h });
}

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = req.headers.get("cookie") || "";
  raw.split(/; */).forEach(p => {
    if (!p) return;
    const i = p.indexOf("=");
    const k = decodeURIComponent(i < 0 ? p : p.slice(0, i)).trim();
    const v = i < 0 ? "" : decodeURIComponent(p.slice(i + 1));
    if (k) out[k] = v;
  });
  return out;
}

export function hasSession(req: Request) {
  const c = parseCookies(req);
  return Boolean(c["access_token"] || c["allstar_at"]);
}

/**
 * Copy upstream Set-Cookie headers, but re-scope them for THIS host.
 * - strips Domain
 * - forces Path=/; SameSite=Lax
 * - keeps Secure/HttpOnly if present
 */
export function forwardSetCookies(up: Response, outHeaders: Headers) {
  // Workers runtime lets us iterate individual Set-Cookie headers
  const cookies: string[] = [];
  up.headers.forEach((v, k) => {
    if (k.toLowerCase() === "set-cookie") cookies.push(v);
  });
  cookies.forEach(raw => {
    // remove Domain=... (so cookie is set for our host)
    let s = raw.replace(/;\s*Domain=[^;]*/i, "");
    // normalize Path + SameSite (keep Secure/HttpOnly if already there)
    s = s.replace(/;\s*Path=[^;]*/i, "");
    s = s.replace(/;\s*SameSite=[^;]*/i, "");
    s += "; Path=/; SameSite=Lax";
    outHeaders.append("Set-Cookie", s);
  });
}

/** Upstream fetch to AUTH worker, forwarding Cookie header */
export async function upstream(req: Request, env: Env, pathAndQuery: string, init?: RequestInit) {
  const url = new URL(env.AUTH_BASE.replace(/\/$/, "") + pathAndQuery);
  const h = new Headers(init?.headers || {});
  // forward original cookies to upstream
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  // always JSON if body present
  if (init?.body && !h.has("content-type")) {
    h.set("content-type", "application/json");
  }
  return fetch(url.toString(), { ...init, headers: h, method: init?.method || "GET" });
}

export async function ensureAccess(req: Request) {
  if (!hasSession(req)) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

/** Simple auth proxy that requires access cookie and forwards to upstream */
export async function proxyWithAuth(req: Request, env: Env, pathnameBase: string) {
  const guard = await ensureAccess(req);
  if (guard) return guard;

  const url = new URL(req.url);
  const pathAndQuery = url.pathname.replace(/^\/api/, "").replace(new RegExp("^" + pathnameBase), pathnameBase) + (url.search || "");
  const init: RequestInit = {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
  };

  const up = await upstream(req, env, pathAndQuery, init);
  const outHeaders = new Headers(up.headers);
  // pass through cookies from upstream (e.g., refresh may rotate access)
  forwardSetCookies(up, outHeaders);
  return new Response(up.body, { status: up.status, headers: outHeaders });
}

/** tiny helper for CORS on GET only (news endpoints) */
export function cors(req: Request, origin: string) {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  if (req.method === "OPTIONS") {
    h.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    h.set("Access-Control-Allow-Headers", "content-type");
    h.set("Access-Control-Max-Age", "86400");
  }
  return h;
}
