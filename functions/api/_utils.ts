// functions/api/_utils.ts

// ===== Cookie/config =====
export const ACCESS_NAME = 'access_token';
export const REFRESH_NAME = 'refresh_token';
const COOKIE_SECURE = true; // custom domain is https
const COOKIE_SAMESITE: 'Lax' | 'Strict' | 'None' = 'Lax';

export type Env = {
  AUTH_BASE?: string; // Auth worker base URL
  // (add other bindings here if you later want strict typing)
};

// ===== Small JSON helper =====
export function json(
  obj: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  const h = new Headers({ 'Content-Type': 'application/json', ...extraHeaders });
  return new Response(JSON.stringify(obj), { status, headers: h });
}

// ===== Cookie helpers =====
export function setCookie(
  name: string,
  val: string,
  {
    maxAge,
    path = '/',
    httpOnly = true,
    secure = COOKIE_SECURE,
    sameSite = COOKIE_SAMESITE,
  }: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
  } = {}
): string {
  const parts = [`${name}=${val}`];
  if (path) parts.push(`Path=${path}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (typeof maxAge === 'number') parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function parseCookies(req: Request): Map<string, string> {
  const out = new Map<string, string>();
  const raw = req.headers.get('cookie') || '';
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) {
      const k = p.slice(0, i).trim();
      const v = p.slice(i + 1).trim();
      if (k) out.set(k, v);
    }
  });
  return out;
}

/** Find a cookie by name inside a Set-Cookie header list and return its value only. */
export function pickCookieFromSetCookie(
  setCookies: string[] | null,
  name: string
): string | null {
  if (!setCookies || !setCookies.length) return null;
  for (const sc of setCookies) {
    const i = sc.indexOf(';');
    const first = i === -1 ? sc : sc.slice(0, i);
    const eq = first.indexOf('=');
    if (eq > -1) {
      const k = first.slice(0, eq).trim();
      const v = first.slice(eq + 1).trim();
      if (k === name) return v;
    }
  }
  return null;
}

// ===== Base URL for the Auth worker =====
export function authBase(env: Env): string {
  return env.AUTH_BASE || 'https://allstar-auth.ataymia.workers.dev';
}

// ===== Low-level fetch to the Auth worker =====
export async function upstream(
  env: Env,
  path: string,
  init: RequestInit = {},
  cookieHeader?: string
): Promise<Response> {
  const url = new URL(path, authBase(env));
  const h = new Headers(init.headers || {});
  if (cookieHeader) h.set('Cookie', cookieHeader);
  return fetch(url.toString(), { ...init, headers: h });
}

// ===== ensureAccess (NEW) =====
// Builds a cookie header containing access/refresh. If access is missing but
// refresh exists, it hits /auth/refresh and returns upstream Set-Cookie headers
// so the caller can forward them to the browser.
export async function ensureAccess(
  req: Request,
  env: Env
): Promise<{
  ok: boolean;
  cookieHeader: string;        // cookies to send upstream
  setCookie?: string[];        // Set-Cookie headers to forward to client
}> {
  const cookies = parseCookies(req);
  let access = cookies.get(ACCESS_NAME) || '';
  let refresh = cookies.get(REFRESH_NAME) || '';

  // If no access but there is refresh, try to refresh
  if (!access && refresh) {
    const res = await upstream(
      env,
      '/auth/refresh',
      { method: 'POST' },
      `${REFRESH_NAME}=${refresh}`
    );

    // Collect all Set-Cookie headers from upstream
    const setCookie: string[] = [];
    res.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'set-cookie') setCookie.push(v);
    });

    // Attempt to pick tokens from Set-Cookie
    const newAccess = pickCookieFromSetCookie(setCookie, ACCESS_NAME);
    const newRefresh = pickCookieFromSetCookie(setCookie, REFRESH_NAME);
    if (newAccess) access = newAccess;
    if (newRefresh) refresh = newRefresh;

    if (res.ok && access) {
      const cookieHeader = [
        access ? `${ACCESS_NAME}=${access}` : '',
        refresh ? `${REFRESH_NAME}=${refresh}` : '',
      ]
        .filter(Boolean)
        .join('; ');
      return { ok: true, cookieHeader, setCookie };
    }

    // Refresh failed
    return { ok: false, cookieHeader: '', setCookie };
  }

  // Already have access (or neither, which means not authed)
  const cookieHeader = [
    access ? `${ACCESS_NAME}=${access}` : '',
    refresh ? `${REFRESH_NAME}=${refresh}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  return { ok: !!access, cookieHeader };
}

// ===== proxyWithAuth (kept) =====
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const cookies = parseCookies(req);
  const parts: string[] = [];
  const a = cookies.get(ACCESS_NAME);
  const r = cookies.get(REFRESH_NAME);
  if (a) parts.push(`${ACCESS_NAME}=${a}`);
  if (r) parts.push(`${REFRESH_NAME}=${r}`);
  const cookieHeader = parts.join('; ');

  const method = init.method || req.method;
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) {
    const ct = req.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
  }
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : init.body ?? (await req.clone().arrayBuffer());

  const res = await upstream(env, path, { method, headers, body }, cookieHeader);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers),
  });
}
