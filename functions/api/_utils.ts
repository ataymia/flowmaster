// functions/api/_utils.ts

// Utilities shared by Pages Functions
// - json(): JSON Response helper
// - setCookie(): build a Set-Cookie string for this host
// - proxyWithAuth(): fetch to upstream AUTH worker carrying cookies through

// Tell Pages where your Auth Worker lives (Settings → Environment variables → AUTH_BASE)
const getAuthBase = (env: Record<string, string> | undefined) =>
  (env?.AUTH_BASE || '').replace(/\/+$/, '');

export function json(data: any, status = 200, extra?: HeadersInit) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  if (extra) {
    for (const [k, v] of new Headers(extra).entries()) h.append(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

type CookieOpts = {
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
};

/** Build a Set-Cookie string for the current host (no Domain= so it sticks to Pages host) */
export function setCookie(name: string, value: string, opts: CookieOpts = {}) {
  const {
    maxAge,
    path = '/',
    httpOnly = true,
    secure = true,
    sameSite = 'None',
  } = opts;

  let c = `${name}=${value}; Path=${path}; SameSite=${sameSite};`;
  if (httpOnly) c += ' HttpOnly;';
  if (secure) c += ' Secure;';
  if (typeof maxAge === 'number') c += ` Max-Age=${maxAge};`;
  return c;
}

/** Pull Cookie header off the incoming request */
function incomingCookie(req: Request) {
  return req.headers.get('cookie') || '';
}

/**
 * Proxy a request to the upstream Auth Worker while passing through cookies.
 * This returns the upstream body/headers, but **from Pages** so Set-Cookie attaches to your Pages domain.
 */
export async function proxyWithAuth(
  ctx: EventContext<any, any, any>,
  path: string,
  init?: RequestInit
) {
  const AUTH_BASE = getAuthBase(ctx.env);
  if (!AUTH_BASE) {
    return json({ error: 'AUTH_BASE not set' }, 500);
  }

  const url = AUTH_BASE + path;

  // carry through cookies to upstream (so /me, /auth/refresh, etc. work)
  const headers = new Headers(init?.headers || {});
  if (!headers.has('cookie')) {
    const ck = incomingCookie(ctx.request);
    if (ck) headers.set('cookie', ck);
  }

  // default credentials are not needed here since this is server-to-server
  const res = await fetch(url, {
    method: init?.method || ctx.request.method,
    headers,
    body: init?.body,
    redirect: 'manual',
  });

  // Return same status/body + headers (including Set-Cookie). Because this response
  // originates from Pages, the browser will attach cookies to your Pages host.
  const outHeaders = new Headers(res.headers);
  return new Response(res.body, { status: res.status, headers: outHeaders });
}
