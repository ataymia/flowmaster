// Minimal helpers shared by the API routes

export const AUTH_BASE = 'https://allstar-auth.ataymia.workers.dev'; // <- your Worker URL

export function json(body: any, status = 200, extra?: HeadersInit) {
  const h = new Headers({ 'content-type': 'application/json', ...(extra || {}) });
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function setCookie(
  name: string,
  val: string,
  opts: { maxAge?: number; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'None'|'Lax'|'Strict' } = {}
) {
  const {
    maxAge,
    path = '/',
    httpOnly = true,
    secure = true,
    sameSite = 'None'
  } = opts;
  let c = `${name}=${val}; Path=${path};`;
  if (httpOnly) c += ' HttpOnly;';
  if (secure) c += ' Secure;';
  if (sameSite) c += ` SameSite=${sameSite};`;
  if (typeof maxAge === 'number') c += ` Max-Age=${maxAge};`;
  return c;
}

export function clearCookie(name: string, path = '/') {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=None;`;
}

// Forward a request to the auth worker, carrying over the browser cookies
export async function upstream(path: string, req: Request, init?: RequestInit) {
  const cookie = req.headers.get('Cookie') || '';
  const headers: HeadersInit = { 'Cookie': cookie };
  if (init?.headers instanceof Headers) {
    init.headers.forEach((v, k) => (headers as any)[k] = v);
  } else if (init?.headers) {
    Object.assign(headers as any, init.headers);
  }
  return fetch(AUTH_BASE + path, {
    method: init?.method || 'GET',
    headers,
    body: init?.body
  });
}

// Pull a cookie value out of Set-Cookie header(s)
export function pickCookieFromSetCookie(setCookieHeader: string | string[], name: string) {
  const all = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader].filter(Boolean);
  for (const sc of all) {
    const m = new RegExp(`${name}=([^;]+)`).exec(sc);
    if (m) return m[1];
  }
  return '';
}
