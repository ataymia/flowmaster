// functions/api/_utils.ts
// Superset helper module compatible with prior versions.
// Exposes: json, parseCookies, setCookie, clearCookie,
// getSetCookieList, copySetCookies, pickCookieFromSetCookie,
// upstream, proxyWithAuth, ensureAccess, type Env.

export type Env = {
  AUTH_BASE?: string; // e.g. https://allstar-auth.ataymia.workers.dev
};

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(headers || {}) },
  });
}

export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get('cookie') || '';
  const out: Record<string, string> = {};
  raw.split(/;\s*/).forEach((p) => {
    if (!p) return;
    const i = p.indexOf('=');
    if (i === -1) return;
    const k = decodeURIComponent(p.slice(0, i));
    const v = decodeURIComponent(p.slice(i + 1));
    out[k] = v;
  });
  return out;
}

export function setCookie(
  name: string,
  value: string,
  opts: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    domain?: string;
  } = {}
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path || '/'}`,
    (opts.httpOnly ?? true) ? 'HttpOnly' : '',
    (opts.secure ?? true) ? 'Secure' : '',
    `SameSite=${opts.sameSite || 'Lax'}`,
  ].filter(Boolean);
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join('; ');
}

export function clearCookie(name: string, path = '/'): string {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Cloudflare’s Headers sometimes expose getSetCookie(); fall back to single header.
export function getSetCookieList(h: Headers): string[] {
  const anyH = h as any;
  if (typeof anyH.getSetCookie === 'function') {
    try {
      const list = anyH.getSetCookie();
      if (Array.isArray(list)) return list;
    } catch {}
  }
  const one = h.get('set-cookie');
  return one ? [one] : [];
}

export function copySetCookies(from: Headers, to: Headers) {
  for (const v of getSetCookieList(from)) to.append('Set-Cookie', v);
}

/** Extract a specific cookie value from Set-Cookie headers (useful after refresh/login). */
export function pickCookieFromSetCookie(h: Headers, name: string): string | null {
  const list = getSetCookieList(h);
  for (const line of list) {
    const m = line.match(new RegExp(`^${name}=([^;]+)`));
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

/** Server-to-server request to your Auth Worker. For most use-cases prefer proxyWithAuth. */
export async function upstream(
  req: Request,
  env: Env,
  path: string,
  init?: RequestInit
): Promise<Response> {
  if (!env.AUTH_BASE) {
    return json({ error: 'AUTH_BASE not configured' }, 500);
  }
  // Ensure path joins correctly whether it starts with "/" or not.
  const u = new URL(path.startsWith('/') ? path : `/${path}`, env.AUTH_BASE);
  const headers = new Headers(init?.headers || {});
  // Forward cookies for session continuity
  const cookie = req.headers.get('cookie');
  if (cookie && !headers.has('cookie')) headers.set('cookie', cookie);
  // Pass content-type through if not set
  if (!headers.has('content-type') && (req.headers.get('content-type') || '').includes('application/json')) {
    headers.set('content-type', 'application/json');
  }
  return fetch(u.toString(), {
    method: init?.method || 'GET',
    headers,
    body: init?.body,
    redirect: 'manual',
    credentials: 'include',
  });
}

/**
 * Turn a Pages Function into a transparent proxy to the Auth Worker.
 * Copies Set-Cookie so cookies land on your Pages domain.
 */
export async function proxyWithAuth(
  ctx: { request: Request; env: Env },
  path: string,
  init?: RequestInit,
  extraHeaderPredicate?: (lowerName: string) => boolean
): Promise<Response> {
  const r = await upstream(ctx.request, ctx.env, path, init);
  const out = new Response(r.body, { status: r.status });

  // Copy common headers; allow caller to pass a predicate for extras.
  const copyNames = new Set(['content-type', 'cache-control', 'etag', 'vary']);
  r.headers.forEach((v, k) => {
    const lower = k.toLowerCase();
    if (copyNames.has(lower) || (extraHeaderPredicate && extraHeaderPredicate(lower))) {
      out.headers.set(k, v);
    }
  });

  // Always split caches by cookie on the proxy response too
  out.headers.set('Vary', 'Cookie');

  // Copy all Set-Cookie headers so cookies are set for staragentdash.work
  copySetCookies(r.headers, out.headers);

  return out;
}

/**
 * Convenience: ensure there is an access token; if not, attempt a refresh via /auth/refresh.
 * Returns true if you should be considered authenticated (may require caller to copy Set-Cookie).
 */
export async function ensureAccess(ctx: { request: Request; env: Env }): Promise<{
  ok: boolean;
  refreshResponse?: Response;
}> {
  const c = parseCookies(ctx.request);
  if (c['access_token']) return { ok: true };

  // Try to refresh using refresh_token; upstream will set a new access cookie.
  const r = await upstream(ctx.request, ctx.env, '/auth/refresh', { method: 'POST' });

  if (r.status === 204) {
    // 204 with Set-Cookie is common — caller must append Set-Cookie to their own response.
    return { ok: true, refreshResponse: r };
  }
  return { ok: false, refreshResponse: r };
}
