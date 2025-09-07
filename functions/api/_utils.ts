// functions/api/_utils.ts

export const AUTH_BASE =
  (globalThis as any).AUTH_BASE ||
  'https://allstar-auth.ataymia.workers.dev';

export type Ctx = Parameters<PagesFunction>[0];

/** JSON helper */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
  });
}

/**
 * Build a Set-Cookie header value.
 * NOTE: Your upstream Worker already sets HttpOnly/SameSite, etc.
 * We provide this to satisfy existing imports (login/logout/refresh).
 */
export function setCookie(
  name: string,
  value: string,
  opts: {
    path?: string;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = {}
): string {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly ?? true) parts.push('HttpOnly');
  if (opts.secure ?? true) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite ?? 'None'}`);
  return parts.join('; ');
}

/**
 * Extract a cookie line from an upstream response's Set-Cookie headers.
 * If not found, returns empty string.
 */
export function pickCookieFromSetCookie(headers: Headers, cookieName: string): string {
  const setCookies = headers.getSetCookie
    ? headers.getSetCookie() // Cloudflare Workers runtime method
    : headers.get('set-cookie'); // fallback (may be a single concatenated string)

  if (!setCookies) return '';

  if (Array.isArray(setCookies)) {
    for (const line of setCookies) {
      if (line.startsWith(`${cookieName}=`)) return line;
    }
    return '';
  }

  // split the combined header safely (CRLF + comma isn't guaranteed; this heuristic works for our simple case)
  const lines = setCookies.split(/,(?=[^;]+?=)/g);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${cookieName}=`)) return trimmed;
  }
  return '';
}

/** Parse cookies from the incoming Request (when needed) */
export function parseCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const c = request.headers.get('cookie');
  if (!c) return out;
  for (const part of c.split(/;\s*/)) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx)] = decodeURIComponent(part.slice(idx + 1));
  }
  return out;
}

/**
 * Low-level upstream call to the Auth Worker.
 * We forward browser cookies so the Worker can authenticate the user.
 * We return the upstream response as-is (including Set-Cookie).
 */
export async function upstream(
  ctx: Ctx,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = AUTH_BASE + path;

  const headers = new Headers(init.headers || {});
  const inCookie = ctx.request.headers.get('cookie');
  if (inCookie) headers.set('cookie', inCookie);

  // keep content-type if body is JSON
  const reqCT = ctx.request.headers.get('content-type');
  if (reqCT && !headers.has('content-type')) headers.set('content-type', reqCT);

  const res = await fetch(url, {
    method: init.method || ctx.request.method,
    headers,
    body: init.body,
  });

  // stream back with upstream headers (including Set-Cookie)
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
}

/**
 * Alias with clearer intent for “proxying a browser-authenticated call”.
 * Currently identical to `upstream`.
 */
export async function proxyWithAuth(
  ctx: Ctx,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return upstream(ctx, path, init);
}
