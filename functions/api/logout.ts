// functions/api/logout.ts
import { Env, json, upstream, parseCookies, forwardSetCookies, clearCookie } from './_utils';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Forward both cookies to upstream so it can clear its side
  const rawCookie = request.headers.get('cookie') || '';
  const up = await upstream(env, '/auth/logout', {
    method: 'POST',
    headers: { cookie: rawCookie }
  });

  const hdr = new Headers();

  // Forward upstream Set-Cookie (if it clears them)
  forwardSetCookies(up, hdr);

  // Always clear locally too (belt & suspenders)
  clearCookie(hdr, 'access_token', '/');
  clearCookie(hdr, 'refresh_token', '/');

  if (!up.ok) {
    const t = await up.text().catch(()=> '');
    return json({ ok: true, note: 'local_cleared_upstream_failed', upstream: t }, 200, hdr);
  }

  return json({ ok: true }, 200, hdr);
};
