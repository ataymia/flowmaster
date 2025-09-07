// functions/api/_utils.ts

export const AUTH_BASE =
  (globalThis as any).AUTH_BASE ||
  // fallback so /api/debug-auth still shows the value:
  // you can override via Cloudflare Pages > Settings > Environment variables
  'https://allstar-auth.ataymia.workers.dev';

export type Ctx = Parameters<PagesFunction>[0];

/** JSON helper */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
  });
}

/** Pass browser auth (cookies) to the Worker and proxy the response back */
export async function proxyWithAuth(
  ctx: Ctx,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = AUTH_BASE + path;

  // Forward cookies (access_token/refresh_token clones) to the Worker
  const inCookie = ctx.request.headers.get('cookie') || '';
  const headers = new Headers(init.headers || {});
  if (inCookie) headers.set('cookie', inCookie);

  // If the original request was JSON, keep content-type on pass-through
  const reqCT = ctx.request.headers.get('content-type');
  if (reqCT && !headers.has('content-type')) headers.set('content-type', reqCT);

  // Do the server-to-server fetch
  const res = await fetch(url, {
    method: init.method || ctx.request.method,
    headers,
    body: init.body,
  });

  // Copy through Set-Cookie (so refresh cycles still work)
  const out = new Response(res.body, {
    status: res.status,
    headers: new Headers(res.headers),
  });

  return out;
}

/** Tiny helper – parse cookies when needed */
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
