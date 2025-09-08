import { json, setCookie, Env } from './_utils';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const email = (body.email || '').toLowerCase().trim();
    const username = (body.username || '').toLowerCase().trim();
    const password = body.password || '';

    const res = await fetch(new URL('/auth/login', env.AUTH_BASE).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email ? { email, password } : { username, password }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return json({ ok: false, error: err || 'LOGIN_FAILED' }, res.status);
    }

    const data = await res.json();
    const headers = new Headers();

    if (data.access) {
      headers.append(
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
      headers.append(
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

    return json(
      {
        ok: true,
        username: data.username,
        role: data.role,
        mustChangePassword: !!data.mustChangePassword,
      },
      200,
      headers
    );
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'SERVER_ERROR' }, 500);
  }
};

export const onRequestGet: PagesFunction = async () =>
  json({ error: 'Method Not Allowed' }, 405);
