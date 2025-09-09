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

/* ---------------- Cookie helpers ---------------- */
type SameSite = 'Lax' | 'Strict' | 'None';

function buildCookie(
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
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join('; ');
}

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
  headers.append('Set-Cookie', buildCookie(name, value, opts));
}

export function clearCookie(headers: Headers, name: string, path = '/') {
  headers.append('Set-Cookie', `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
}

export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get('cookie') || '';
  const map: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) map[k] = decodeURIComponent(v);
    }
  }
  return map;
}

export function getCookie(req: Request, name: string): string | undefined {
  return parseCookies(req)[name];
}

/* ---------------- Session helpers ---------------- */

export function hasSessionCookie(req: Request): boolean {
  const c = parseCookies(req);
  // treat any of these as “logged in” (matches our flows)
  return !!(c['access_token'] || c['refresh_token'] || c['allstar_at']);
}

/**
 * If there is a session cookie, returns {ok:true}.
 * Otherwise returns {ok:false,response:Response(401)}.
 */
export function ensureAccess(request: Request) {
  if (hasSessionCookie(request)) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    response: json({ error: 'unauthorized' }, 401, { 'cache-control': 'no-store' }),
  };
}

/* ---------------- Set-Cookie forwarding ---------------- */

/**
 * Forward every Set-Cookie from an upstream response to the caller.
 * Cloudflare may flatten multiple Set-Cookie headers; the split below is safe.
 */
export function forwardSetCookies(src: Headers, dst: Headers) {
  // Try the single header first
  const combined = src.get('set-cookie');
  if (!combined) return;

  // Split into individual cookie lines (handles flattened header)
  const lines = combined.split(/,(?=[^;]+?=)/g);
  for (const line of lines) {
    if (line && line.trim()) dst.append('Set-Cookie', line.trim());
  }
}

// Optional helper if you ever need to pluck one cookie by name.
export function pickCookieFromSetCookie(src: Headers, cookieName: string): string | null {
  const combined = src.get('set-cookie');
  if (!combined) return null;
  const lines = combined.split(/,(?=[^;]+?=)/g);
  for (const l of lines) {
    const first = l.split(';', 1)[0]?.trim() || '';
    if (first.toLowerCase().startsWith(cookieName.toLowerCase() + '=')) return first;
  }
  return null;
}

/* ---------------- Upstream helpers ---------------- */

/**
 * Call your auth Worker with any headers/body you pass.
 * `path` can be '/login', '/refresh', '/whoami', etc. (relative to AUTH_BASE),
 * or a full URL if you prefer.
 */
export function upstream(env: Env, path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : new URL(path, env.AUTH_BASE).toString();
  return fetch(url, init);
}

/**
 * Minimal proxy helper that uses the access_token cookie to add
 * Authorization: Bearer <access_token> when calling your auth Worker.
 * It returns upstream’s body/status and forwards Set-Cookie back to the browser.
 */
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const cookies = parseCookies(req);
  const access = cookies['access_token'];
  if (!access) return json({ error: 'unauthorized' }, 401, { 'cache-control': 'no-store' });

  const url = path.startsWith('http') ? path : new URL(path, env.AUTH_BASE).toString();
  const headers = new Headers(init.headers || {});
  if (!headers.has('authorization')) headers.set('authorization', `Bearer ${access}`);

  // Forward content-type if caller didn’t set one
  const ct = req.headers.get('content-type');
  if (ct && !headers.has('content-type')) headers.set('content-type', ct);

  const up = await fetch(url, { ...init, headers });
  const outHeaders = new Headers();
  const upCT = up.headers.get('content-type');
  if (upCT) outHeaders.set('content-type', upCT);
  forwardSetCookies(up.headers, outHeaders);

  return new Response(up.body, { status: up.status, headers: outHeaders });
}
