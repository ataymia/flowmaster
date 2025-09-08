// Shared helpers for Pages Functions (Cloudflare Workers runtime)
export interface Env {
  AUTH_BASE: string;              // e.g. https://allstar-auth.ataymia.workers.dev
  NOTION_SECRET?: string;         // Notion internal integration token
  NOTION_DATABASE_ID?: string;    // Team Billboard database id
}

/* ---------- Basic JSON helper ---------- */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
  });
}

/* ---------- Cookie helpers ---------- */
type SameSite = 'Lax' | 'Strict' | 'None';

export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  opts: {
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: SameSite;
    maxAge?: number; // seconds
  } = {}
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.httpOnly ?? true) parts.push('HttpOnly');
  if (opts.secure ?? true) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  headers.append('Set-Cookie', parts.join('; '));
}

export function clearCookie(headers: Headers, name: string, path = '/') {
  headers.append(
    'Set-Cookie',
    `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  );
}

export function parseCookies(req: Request): Map<string, string> {
  const out = new Map<string, string>();
  const raw = req.headers.get('cookie');
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out.set(k, decodeURIComponent(rest.join('=')));
  }
  return out;
}

export function pickCookieFromSetCookie(
  setCookie: string[] | null | undefined,
  name: string
): string | null {
  if (!setCookie?.length) return null;
  for (const line of setCookie) {
    const [pair] = line.split(';', 1);
    if (!pair) continue;
    const [k, v] = pair.split('=', 2);
    if (k?.trim() === name) return v ?? null;
  }
  return null;
}

/* ---------- Token helpers ---------- */
export function getAccessFromRequest(req: Request): string | null {
  const cookies = parseCookies(req);
  return cookies.get('access_token') ?? null;
}
export function getRefreshFromRequest(req: Request): string | null {
  const cookies = parseCookies(req);
  return cookies.get('refresh_token') ?? null;
}

/**
 * ensureAccess:
 * - Returns {ok:true, token} if access token exists.
 * - Otherwise returns a 401 JSON Response you can return from handlers.
 */
export function ensureAccess(req: Request) {
  const token = getAccessFromRequest(req);
  if (!token) return { ok: false as const, response: json({ error: 'unauthorized' }, 401) };
  return { ok: true as const, token };
}

/* ---------- Upstream helpers ---------- */

/**
 * upstream: simple fetch to AUTH_BASE + path
 */
export function upstream(
  env: Env,
  path: string,
  init?: RequestInit
): Promise<Response> {
  // Allow callers to pass absolute URLs too
  const url = path.startsWith('http') ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}

/**
 * proxyWithAuth:
 * - Grabs access_token from cookies
 * - Adds Authorization: Bearer <token>
 * - Proxies to env.AUTH_BASE + path (or absolute path passed in)
 * - You can pass method/body/headers in init; we merge headers
 */
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit & { headers?: HeadersInit } = {}
): Promise<Response> {
  const cookies = parseCookies(req);
  const access = cookies.get('access_token');
  if (!access) return json({ error: 'unauthorized' }, 401);

  const headers = new Headers(init.headers || {});
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${access}`);

  // If original request had JSON body and no explicit content-type, add it
  if (init.body && !headers.has('content-type')) {
    // best-effort; callers may set it themselves
    headers.set('content-type', 'application/json');
  }

  const url = path.startsWith('http') ? path : `${env.AUTH_BASE}${path}`;
  const res = await fetch(url, { ...init, headers });

  // Pass-through response (body, status, headers)
  const outHeaders = new Headers(res.headers);
  return new Response(res.body, { status: res.status, headers: outHeaders });
}

/* ---------- Small CORS helper (optional) ---------- */
export function withCors(resp: Response, origin?: string) {
  const h = new Headers(resp.headers);
  if (origin) {
    h.set('access-control-allow-origin', origin);
    h.set('access-control-allow-credentials', 'true');
  }
  return new Response(resp.body, { status: resp.status, headers: h });
}

export function preflight(origin?: string) {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin || '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-max-age': '86400',
    },
  });
}
