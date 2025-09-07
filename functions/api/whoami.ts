import { upstream, json, setCookie, pickCookieFromSetCookie } from './_utils';

export async function onRequestGet(ctx: { request: Request }) {
  // Try with whatever access_token we have
  let me = await upstream('/me', ctx.request);
  if (me.ok) {
    const j = await me.json();
    return json({ authed: true, ...j });
  }

  // Attempt silent refresh using refresh_token (Path=/ ensures the browser sends it)
  const ref = await upstream('/auth/refresh', ctx.request, { method: 'POST' });
  if (ref.ok) {
    // Mirror the new access_token to our domain
    const setCookies = (ref.headers as any).getSetCookie?.() ?? ref.headers.get('set-cookie') ?? '';
    const access = pickCookieFromSetCookie(setCookies, 'access_token');
    const h = new Headers();
    if (access) h.append('Set-Cookie', setCookie('access_token', access, { maxAge: 60*15, path: '/' }));

    // Now call /me again
    me = await upstream('/me', ctx.request);
    if (me.ok) {
      const j = await me.json();
      return new Response(JSON.stringify({ authed: true, ...j }), { status: 200, headers: h });
    }
    return new Response(JSON.stringify({ authed: false }), { status: 401, headers: h });
  }

  return json({ authed: false }, 401);
}
