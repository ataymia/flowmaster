// functions/api/whoami.ts
import { Env, json, upstream, parseCookies, forwardSetCookies, setCookie } from './_utils';

async function callMe(env: Env, cookieHeader: string) {
  return upstream(env, '/me', { headers: { cookie: cookieHeader } });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const cookies = parseCookies(request);
  const access = cookies.get('access_token');
  const refresh = cookies.get('refresh_token');
  if (!access && !refresh) return json({ error: 'unauthorized' }, 401);

  const hdr = new Headers();
  const cookieHeader = request.headers.get('cookie') || '';

  // 1) Try current access
  let me = await callMe(env, cookieHeader);
  if (me.ok) {
    hdr.set('content-type', 'application/json');
    return new Response(await me.text(), { status: 200, headers: hdr });
  }

  // If not 401, pass through upstream error
  if (me.status !== 401 && me.status !== 403) {
    const t = await me.text().catch(()=> '');
    return json({ error: 'upstream_error', detail: t }, me.status);
  }

  // 2) Try to refresh if we have a refresh token
  if (!refresh) return json({ error: 'unauthorized' }, 401);

  const ref = await upstream(env, '/auth/refresh', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cookie': `refresh_token=${encodeURIComponent(refresh)}`
    },
    body: JSON.stringify({}),
  });

  // forward cookies from refresh
  forwardSetCookies(ref, hdr, { accessMaxAge: 60*15, refreshMaxAge: 60*60*24*30 });

  // if body has tokens, set explicitly too
  let rj: any = null;
  try { rj = await ref.clone().json(); } catch {}
  if (rj?.access || rj?.access_token) {
    setCookie(hdr, 'access_token', rj.access || rj.access_token, { httpOnly:true, secure:true, sameSite:'Lax', path:'/', maxAge:60*15 });
  }
  if (!ref.ok) return json({ error: 'refresh_failed' }, 401, hdr);

  // 3) Retry /me with new access cookie
  const mergedCookie = (() => {
    // Rebuild a cookie header with existing cookies; browser will receive Set-Cookie anyway
    const c = parseCookies(request);
    if (rj?.access || rj?.access_token) c.set('access_token', (rj.access || rj.access_token));
    // Recompose
    return Array.from(c.entries()).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  })();

  me = await callMe(env, mergedCookie);
  if (!me.ok) return json({ error: 'whoami_failed' }, me.status, hdr);

  hdr.set('content-type', 'application/json');
  return new Response(await me.text(), { status: 200, headers: hdr });
};
