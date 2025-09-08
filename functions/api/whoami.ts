// functions/api/whoami.ts
import { json, parseCookies, upstream, copySetCookies } from './_utils';

export const onRequestGet: PagesFunction<{ AUTH_BASE: string }> = async ({ request, env }) => {
  const cookies = parseCookies(request);
  let needRefresh = !cookies['access_token'];

  if (needRefresh) {
    // Try silent refresh using refresh_token; forward any Set-Cookie
    const r = await fetch('/api/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include' });
    // The browser won’t send cookies to this server-side call; so do a server-side refresh instead:
    // (Calls upstream with the same Cookie header as the incoming request)
    const sr = await upstream(request, env, '/auth/refresh', { method: 'POST' });
    if (sr.status !== 204) return json({ error: 'UNAUTHORIZED' }, 401);
    // We need to return Set-Cookie to the browser:
    const out = new Response(null, { status: 204, headers: { 'Vary': 'Cookie' } });
    copySetCookies(sr.headers, out.headers);
    // Return 204 so the client can immediately call whoami again; BUT we can also fall through and call /me now:
    // For convenience, call /me right away.
    const me = await upstream(request, env, '/me', { method: 'GET' });
    if (!me.ok) return json({ error: 'UNAUTHORIZED' }, 401);
    const final = new Response(await me.text(), { status: 200, headers: { 'content-type': 'application/json', 'Vary': 'Cookie' } });
    copySetCookies(sr.headers, final.headers); // include new access cookie in this response too
    return final;
  }

  // Access token present: just ask /me
  const me = await upstream(request, env, '/me', { method: 'GET' });
  if (!me.ok) return json({ error: 'UNAUTHORIZED' }, 401);
  const out = new Response(await me.text(), { status: 200, headers: { 'content-type': 'application/json', 'Vary': 'Cookie' } });
  return out;
};
