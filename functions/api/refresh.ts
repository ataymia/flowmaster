// functions/api/refresh.ts
import { Env, json, upstream, parseCookies, forwardSetCookies, setCookie } from './_utils';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cookies = parseCookies(request);
  const refresh = cookies.get('refresh_token');
  if (!refresh) return json({ error: 'no_refresh' }, 401);

  // Forward the refresh cookie to upstream
  const up = await upstream(env, '/auth/refresh', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cookie': `refresh_token=${encodeURIComponent(refresh)}`
    },
    body: JSON.stringify({}), // some workers ignore body; cookie is the key thing
  });

  const hdr = new Headers();

  // Forward any Set-Cookie from upstream
  forwardSetCookies(up, hdr, {
    accessMaxAge: 60 * 15,
    refreshMaxAge: 60 * 60 * 24 * 30,
  });

  // Fallback: if upstream returns tokens in JSON, set them
  let data: any = null;
  try { data = await up.clone().json(); } catch {}
  if (data) {
    const access = data.access || data.access_token;
    const refreshNew = data.refresh || data.refresh_token;
    if (access) setCookie(hdr, 'access_token', access, { httpOnly:true, secure:true, sameSite:'Lax', path:'/', maxAge:60*15 });
    if (refreshNew) setCookie(hdr, 'refresh_token', refreshNew, { httpOnly:true, secure:true, sameSite:'Lax', path:'/', maxAge:60*60*24*30 });
  }

  if (!up.ok) {
    const t = await up.text().catch(()=>'');
    return json({ error: 'refresh_failed', detail: t }, up.status);
  }

  return json({ ok: true }, 200, hdr);
};
