// functions/api/_utils.ts

export interface Env {
  AUTH_BASE: string;            // e.g., https://allstar-auth.ataymia.workers.dev
  NOTION_TOKEN?: string;        // "secret_..."
  NOTION_DATABASE_ID?: string;  // Notion DB id
}

/* ---------------- JSON helper ---------------- */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
  });
}

/* ---------------- cookies ---------------- */
function parseCookie(hdr: string | null): Record<string,string> {
  const out: Record<string,string> = {};
  if (!hdr) return out;
  hdr.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1).trim());
  });
  return out;
}
export function getCookie(req: Request, name: string): string | null {
  const m = parseCookie(req.headers.get('cookie')); return m[name] ?? null;
}

/* ---------------- session helpers ----------------
   We now accept EITHER:
   - access_token (classic)
   - allstar_at   (your Pages-side session cookie that holds an access JWT)
---------------------------------------------------*/
export function ensureSession(req: Request) {
  const access = getCookie(req, 'access_token');
  const allstar = getCookie(req, 'allstar_at');
  if (access || allstar) return { ok: true as const };
  return { ok: false as const, response: json({ error: 'unauthorized' }, 401, { 'cache-control':'no-store' }) };
}
/** Kept for older imports; accepts either cookie now */
export function ensureAccess(req: Request) { return ensureSession(req); }

/* ------------- upstream + proxy helpers ------------- */

/** Bare upstream call (no auth added) */
export function upstream(env: Env, path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}

/** For endpoints that expect Bearer access_token */
export async function proxyWithAuth(req: Request, env: Env, path: string, init: RequestInit = {}) {
  const access = getCookie(req, 'access_token') || getCookie(req, 'allstar_at');
  if (!access) return json({ error: 'unauthorized' }, 401);
  const headers = new Headers(init.headers || {});
  if (!headers.has('authorization')) headers.set('authorization', `Bearer ${access}`);
  const res = await upstream(env, path, { ...init, headers });
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
}

/** For endpoints that expect the token in a Cookie (your Worker’s /me, /presence, etc.) */
export async function proxyWithSession(req: Request, env: Env, path: string, init: RequestInit = {}) {
  const access = getCookie(req, 'access_token') || getCookie(req, 'allstar_at');
  if (!access) return json({ error: 'unauthorized' }, 401);
  const headers = new Headers(init.headers || {});
  // forward a cookie the Worker understands
  headers.set('cookie', `access_token=${access}`);
  // preserve JSON content-type if caller had one
  const ct = req.headers.get('content-type');
  if (ct && !headers.has('content-type')) headers.set('content-type', ct);
  const res = await upstream(env, path, { ...init, headers, method: init.method || req.method, body: init.body ?? req.body });
  // bubble content-type + any Set-Cookie back
  const out = new Headers();
  const resCT = res.headers.get('content-type'); if (resCT) out.set('content-type', resCT);
  // flatten multi set-cookie
  const sc = res.headers.get('set-cookie'); if (sc) out.append('set-cookie', sc);
  return new Response(res.body, { status: res.status, headers: out });
}
