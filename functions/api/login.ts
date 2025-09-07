// functions/api/login.ts
import { json, setCookie } from './_utils';

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').toLowerCase().trim();
    const username = (body.username || '').toLowerCase().trim();
    const password = body.password || '';

    // call Worker upstream (your auth service) as before:
    const res = await fetch(env.AUTH_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        email ? { email, password } : { username, password }
      ),
    });

    // bubble up any error payload, but don't throw opaque 1101
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return json({ ok: false, error: err || 'LOGIN_FAILED' }, res.status);
    }

    // read tokens from body so we can mirror them as first-party cookies
    const data = await res.json();
    const access = data.access;
    const refresh = data.refresh;

    const headers = new Headers();
    if (access) {
      headers.append(
        'Set-Cookie',
        setCookie('access_token', access, { httpOnly: true, sameSite: 'None', secure: true, path: '/', maxAge: 60 * 15 })
      );
    }
    if (refresh) {
      headers.append(
        'Set-Cookie',
        setCookie('refresh_token', refresh, { httpOnly: true, sameSite: 'None', secure: true, path: '/api', maxAge: 60 * 60 * 24 * 7 })
      );
    }

    return json(
      {
        ok: true,
        username: data.username,
        role: data.role,
        mustChangePassword: !!data.mustChangePassword
      },
      200,
      headers
    );
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'SERVER_ERROR' }, 500);
  }
};

// Optional: make GET return a friendly JSON instead of 1101 when visited directly
export const onRequestGet: PagesFunction = async () =>
  json({ error: 'Method Not Allowed' }, 405);
