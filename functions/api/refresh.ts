import { json, parseCookies, setCookie, upstream, Env } from './_utils';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const c = parseCookies(request);
  const refresh = c['refresh_token'];
  if (!refresh) return json({ ok: false, error: 'NO_REFRESH' }, 401);

  const res = await upstream(env, '/auth/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${refresh}` },
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return json({ ok: false, error: t || 'REFRESH_FAILED' }, res.status);
  }

  const data = await res.json().catch(() => ({}));
  const h = new Headers();

  if (data.access) {
    h.append(
      'Set-Cookie',
      setCookie('access_token', data.access, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 60 * 15,
      })
    );
  }
  if (data.refresh) {
    h.append(
      'Set-Cookie',
      setCookie('refresh_token', data.refresh, {
        path: '/api',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 60 * 60 * 24 * 7,
      })
    );
  }

  return json({ ok: true }, 200, h);
};
