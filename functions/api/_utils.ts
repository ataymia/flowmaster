// functions/api/_utils.ts

// ----- cookie & misc config -----
const ACCESS_NAME = 'access_token';
const REFRESH_NAME = 'refresh_token';
const COOKIE_SECURE = true;        // your custom domain is HTTPS
const COOKIE_SAMESITE: 'Lax' | 'Strict' | 'None' = 'Lax';

// ----- tiny JSON helper -----
export function json(
  obj: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  const h = new Headers({
    'Content-Type': 'application/json',
    ...extraHeaders,
  });
  return new Response(JSON.stringify(obj), { status, headers: h });
}

// ----- cookie helpers -----
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

// ----- base URL for the Auth worker -----
export function authBase(env: any): string {
  // Keep your default here if NOT set in Pages env vars
  return (env && env.AUTH_BASE) || 'https://allstar-auth.ataymia.workers.dev';
}

// ----- low-level fetch to the Auth worker -----
export async function upstream(
  env: any,
  path: string,
  init: RequestInit = {},
  cookieHeader?: string
): Promise<Response> {
  const url = new URL(path, authBase(env));
  const h = new Headers(init.headers || {});
  if (cookieHeader) h.set('Cookie', cookieHeader);
  return fetch(url.toString(), { ...init, headers: h });
}

// ----- proxy with auth cookies (NEW) -----
// Forwards the incoming request to the Auth worker, attaching the access/refresh cookies.
// It streams the upstream response back to the client.
export async function proxyWithAuth(
  req: Request,
  env: any,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  // Build cookie header limited to tokens we actually need
  const cookies = parseCookies(req);
  const parts: string[] = [];
  const a = cookies.get(ACCESS_NAME);
  const r = cookies.get(REFRESH_NAME);
  if (a) parts.push(`${ACCESS_NAME}=${a}`);
  if (r) parts.push(`${REFRESH_NAME}=${r}`);
  const cookieHeader = parts.join('; ');

  // Prepare method/body/headers pass-through
  const method = init.method || req.method;
  const headers = new Headers(init.headers || {});
  // copy content-type from original if needed
  if (!headers.has('Content-Type')) {
    const ct = req.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
  }

  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : init.body ?? (await req.clone().arrayBuffer());

  const res = await upstream(env, path, { method, headers, body }, cookieHeader);

  // Stream back response; also forward any useful headers (including JSON, caching, etc.)
  const outHeaders = new Headers(res.headers);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}
