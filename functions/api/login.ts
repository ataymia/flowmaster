// functions/api/login.ts
import { Env, json, upstream, forwardSetCookies, setCookie } from './_utils';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: any = null;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (!body?.username && !body?.email) return json({ error: 'missing_username_or_email' }, 400);
  if (!body?.password) return json({ error: 'missing_password' }, 400);

  // Send through to your auth worker
  const up = await upstream(env, '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const hdr = new Headers();

  // Forward upstream cookies (if any) onto our domain
  forwardSetCookies(up, hdr, {
    accessMaxAge: 60 * 15,
    refreshMaxAge: 60 * 60 * 24 * 30,
  });

  // Also, if upstream returns tokens in JSON body, set them explicitly
  let data: any = null;
  try { data = await up.clone().json(); } catch {}
  if (data) {
    const access = data.access || data.access_token;
    const refresh = data.refresh || data.refresh_token;
    if (access) setCookie(hdr, 'access_token', access, { httpOnly: true, secure: true, sameSite: 'Lax', path:'/', maxAge: 60*15 });
    if (refresh) setCookie(hdr, 'refresh_token', refresh, { httpOnly: true, secure: true, sameSite: 'Lax', path:'/', maxAge: 60*60*24*30 });
  }

  if (!up.ok) {
    // pass upstream status/body for debugging
    const txt = await up.text().catch(() => '');
    return json({ error: 'auth_failed', detail: txt }, up.status);
  }

  return json({ ok: true }, 200, hdr);
};
