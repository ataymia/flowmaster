// functions/api/_utils.ts
export type Env = { AUTH_BASE?: string };

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

export function getSetCookieList(h: Headers): string[] {
  const anyH = h as any;
  if (typeof anyH.getSetCookie === 'function') {
    try { const list = anyH.getSetCookie(); if (Array.isArray(list)) return list; } catch {}
  }
  const one = h.get('set-cookie');
  return one ? [one] : [];
}

export function copySetCookies(from: Headers, to: Headers) {
  for (const v of getSetCookieList(from)) to.append('Set-Cookie', v);
}

export async function upstream(req: Request, env: Env, path: string, init?: RequestInit) {
  if (!env.AUTH_BASE) return json({ error: 'AUTH_BASE not configured' }, 500);
  const url = new URL(path.startsWith('/') ? path : `/${path}`, env.AUTH_BASE);
  const headers = new Headers(init?.headers || {});
  // forward browser cookies upstream; the worker just reads header text
  const cookie = req.headers.get('cookie');
  if (cookie && !headers.has('cookie')) headers.set('cookie', cookie);
  if (!headers.has('content-type') && (req.headers.get('content-type') || '').includes('application/json')) {
    headers.set('content-type', 'application/json');
  }
  return fetch(url.toString(), {
    method: init?.method || 'GET',
    headers,
    body: init?.body,
    redirect: 'manual',
    credentials: 'include',
  });
}
