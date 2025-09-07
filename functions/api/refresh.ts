import { upstream, json, pickCookieFromSetCookie, setCookie } from './_utils';

export async function onRequestPost(ctx: { request: Request }) {
  // Ask the worker to refresh. Browser will send our refresh_token (Path=/).
  const up = await upstream('/auth/refresh', ctx.request, { method: 'POST' });

  // The worker responds 204 + Set-Cookie (access_token=… on its domain)
  // We mirror that access_token onto our domain.
  const setCookies = (up.headers as any).getSetCookie?.() ?? up.headers.get('set-cookie') ?? '';
  const access = pickCookieFromSetCookie(setCookies, 'access_token');
  const headers = new Headers({ 'content-type': 'application/json' });
  if (access) headers.append('Set-Cookie', setCookie('access_token', access, { maxAge: 60*15, path: '/' }));

  return new Response(null, { status: up.status, headers });
}
