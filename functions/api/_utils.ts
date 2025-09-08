// Shared helpers for Pages Functions

export type Env = {
  AUTH_BASE: string;               // e.g. https://allstar-auth.<your>.workers.dev
  NOTION_SECRET?: string;
  NOTION_DB_BILLBOARD?: string;
  NOTION_PROP_TITLE?: string;
  NOTION_PROP_BODY?: string;
  NOTION_PROP_PUBLISH?: string;
  NOTION_PROP_EXPIRES?: string;
  NOTION_PROP_PINNED?: string;
  NOTION_PROP_AUDIENCE?: string;
};

export function json(data: any, status = 200, headers?: HeadersInit) {
  const h = new Headers({ 'Content-Type': 'application/json' });
  if (headers) new Headers(headers).forEach((v, k) => h.set(k, v));
  return new Response(JSON.stringify(data), { status, headers: h });
}

type CookieOpts = {
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  maxAge?: number;   // seconds
  expires?: Date;
};

export function setCookie(
  name: string,
  value: string,
  {
    path = '/',
    domain,
    httpOnly = true,
    secure = true,
    sameSite = 'None',
    maxAge,
    expires,
  }: CookieOpts = {}
) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`];
  if (domain) parts.push(`Domain=${domain}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.max(0, maxAge)}`);
  if (expires instanceof Date) parts.push(`Expires=${expires.toUTCString()}`);
  return parts.join('; ');
}

export function clearCookie(name: string, path = '/') {
  return setCookie(name, '', { path, maxAge: 0, expires: new Date(0) });
}

export function parseCookies(request: Request) {
  const header = request.headers.get('cookie') || '';
  const out: Record<string, string> = {};
  header.split(/; */).forEach((kv) => {
    if (!kv) return;
    const i = kv.indexOf('=');
    const k = decodeURIComponent(kv.slice(0, i).trim());
    const v = decodeURIComponent(kv.slice(i + 1).trim());
    out[k] = v;
  });
  return out;
}

export function pickCookieFromSetCookie(
  res: Response,
  name: string
): string | null {
  const all = res.headers.get('set-cookie');
  if (!all) return null;
  const cookies = Array.isArray(all) ? all : [all];
  for (const c of cookies) {
    if (c.toLowerCase().startsWith(`${name.toLowerCase()}=`)) return c;
  }
  return null;
}

export async function upstream(
  env: Env,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = new URL(path, env.AUTH_BASE).toString();
  return fetch(url, init);
}

/**
 * Ensure we have a usable access token; if we can refresh, do it and
 * return Set-Cookie headers we need to mirror on our domain.
 */
export async function ensureAccess(
  request: Request,
  env: Env
): Promise<{ access?: string; set: string[] }> {
  const c = parseCookies(request);
  let access = c['access_token'];
  const refresh = c['refresh_token'];
  const set: string[] = [];

  if (!access && refresh) {
    const res = await upstream(env, '/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refresh}` },
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.access) {
        access = data.access;
        set.push(
          setCookie('access_token', data.access, {
            path: '/',
            sameSite: 'None',
            secure: true,
            httpOnly: true,
            maxAge: 60 * 15,
          })
        );
      }
      if (data.refresh) {
        set.push(
          setCookie('refresh_token', data.refresh, {
            path: '/api',
            sameSite: 'None',
            secure: true,
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7,
          })
        );
      }
    }
  }

  return { access, set };
}
