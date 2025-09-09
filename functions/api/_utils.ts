export interface Env {
  AUTH_BASE: string;            // e.g. https://allstar-auth.your.workers.dev
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
}

/* ---------- JSON ---------- */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
  });
}

/* ---------- cookies ---------- */
function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  opts: { path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'Lax'|'Strict'|'None'; maxAge?: number } = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.httpOnly ?? true) parts.push('HttpOnly');
  if (opts.secure   ?? true) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${opts.maxAge}`);
  headers.append('Set-Cookie', parts.join('; '));
}

export function clearCookie(headers: Headers, name: string, path = '/') {
  headers.append('Set-Cookie', `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
}

/* Our site-local session cookie */
export function getLocalAccess(req: Request) {
  // We use allstar_at as the Pages-domain session; fallback to access_token if you ever set it here too.
  return readCookie(req, 'allstar_at') || readCookie(req, 'access_token');
}

/* ---------- auth guard ---------- */
export function ensureAccess(req: Request) {
  const token = getLocalAccess(req);
  if (!token) return { ok:false as const, response: json({ error:'unauthorized' }, 401, { 'cache-control':'no-store' }) };
  return { ok:true as const, token };
}

/* ---------- upstream ---------- */
export function upstream(env: Env, path: string, init: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}

/* ---------- set-cookie forwarding helpers ---------- */
export function forwardSetCookies(from: Headers, to: Headers) {
  const raw = from.get('set-cookie');
  if (!raw) return;
  const parts = raw.split(/,(?=[^;]+?=)/g);
  for (const p of parts) to.append('set-cookie', p.trim());
}

export function pickCookieFromSetCookie(from: Headers, name: string): string | null {
  const raw = from.get('set-cookie');
  if (!raw) return null;
  const parts = raw.split(/,(?=[^;]+?=)/g);
  for (const line of parts) {
    const [pair] = line.split(';', 1);
    if (!pair) continue;
    const [k,v] = pair.split('=',2);
    if (k?.trim() === name) return v ?? null;
  }
  return null;
}

/* ---------- bearer proxy ---------- */
export async function proxyWithAuth(req: Request, env: Env, path: string, init: RequestInit = {}) {
  const g = ensureAccess(req);
  if (!g.ok) return g.response;
  const h = new Headers(init.headers || {});
  h.set('authorization', `Bearer ${g.token}`);
  // pass through JSON content-type if present
  const ct = req.headers.get('content-type');
  if (ct && !h.has('content-type')) h.set('content-type', ct);
  const res = await upstream(env, path, { ...init, method: req.method, body: req.body, headers: h });
  const out = new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
  return out;
}
// Alias for older code that still imports proxyWithSession
export async function proxyWithSession(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  return proxyWithAuth(req, env, path, init);
}
