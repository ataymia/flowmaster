// functions/api/_utils.ts

export interface Env {
  AUTH_BASE: string;            // e.g. https://allstar-auth.ataymia.workers.dev
  NOTION_TOKEN?: string;        // "secret_..."
  NOTION_DATABASE_ID?: string;  // Notion DB id
}

/* ------------ JSON helper ------------ */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
  });
}

/* ------------ Cookie helpers ------------ */
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
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${opts.maxAge}`);
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

/**
 * Read Set-Cookie headers from an upstream Response and re-emit them
 * for the current domain with safe attributes (no Domain), using Lax.
 */
// in functions/api/_utils.ts

export function forwardSetCookies(
  upstreamResp: Response,
  outHeaders: Headers,
  defaults: { accessMaxAge?: number; refreshMaxAge?: number } = {}
) {
  let setCookies: string[] = [];

  // 1) CF Workers runtime helper (preferred)
  const anyHeaders = upstreamResp.headers as any;
  if (typeof anyHeaders.getSetCookie === 'function') {
    setCookies = anyHeaders.getSetCookie() || [];
  }

  // 2) Fallback: iterate all headers and collect each set-cookie line
  if (!setCookies.length) {
    try {
      (upstreamResp.headers as any).forEach?.((value: string, key: string) => {
        if (key && key.toLowerCase() === 'set-cookie' && value) setCookies.push(value);
      });
    } catch {}
  }

  // 3) Last resort: a single header (often only the first cookie)
  if (!setCookies.length) {
    const single = upstreamResp.headers.get('set-cookie');
    if (single) setCookies = [single];
  }

  if (!setCookies.length) return;

  for (const line of setCookies) {
    const parts = line.split(';').map(s => s.trim());
    const [pair, ...attrs] = parts;
    if (!pair) continue;
    const [rawName, ...vrest] = pair.split('=');
    const name = (rawName || '').trim();
    const value = vrest.join('=');

    let maxAge: number | undefined;
    for (const a of attrs) {
      const [ak, av] = a.split('=');
      if (ak && ak.toLowerCase() === 'max-age') {
        const n = Number(av);
        if (!Number.isNaN(n)) maxAge = n;
      }
    }
    if (maxAge === undefined) {
      if (name === 'access_token' && defaults.accessMaxAge) maxAge = defaults.accessMaxAge;
      if (name === 'refresh_token' && defaults.refreshMaxAge) maxAge = defaults.refreshMaxAge;
    }

    // Re-emit as host-only cookies (no Domain) so they work on pages.dev and your custom domain
    setCookie(outHeaders, name, value, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge,
    });
  }
}


    // Optional defaults
    if (maxAge === undefined) {
      if (name === 'access_token' && defaults.accessMaxAge) maxAge = defaults.accessMaxAge;
      if (name === 'refresh_token' && defaults.refreshMaxAge) maxAge = defaults.refreshMaxAge;
    }

    // Re-set cookie for our domain
    setCookie(outHeaders, name, value, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge,
    });
  }
}

/* ------------ Token accessors ------------ */
export function getAccessFromRequest(req: Request) {
  return parseCookies(req).get('access_token') ?? null;
}
export function getRefreshFromRequest(req: Request) {
  return parseCookies(req).get('refresh_token') ?? null;
}

/**
 * ensureAccess:
 * - Returns { ok:true, token } if access_token exists on the request
 * - Otherwise returns { ok:false, response: 401 JSON }
 */
export function ensureAccess(req: Request) {
  const token = getAccessFromRequest(req);
  if (!token) return { ok: false as const, response: json({ error: 'unauthorized' }, 401) };
  return { ok: true as const, token };
}

/* ------------ Upstream convenience ------------ */
export function upstream(env: Env, path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}

/**
 * Proxy with Authorization: Bearer <access_token> from cookies
 */
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const access = getAccessFromRequest(req);
  if (!access) return json({ error: 'unauthorized' }, 401);
  const headers = new Headers(init.headers || {});
  if (!headers.has('authorization')) headers.set('authorization', `Bearer ${access}`);
  const url = path.startsWith('http') ? path : `${env.AUTH_BASE}${path}`;
  const res = await fetch(url, { ...init, headers });
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
}
