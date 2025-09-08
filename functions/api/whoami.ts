import { json, ensureAccess, upstream, Env } from './_utils';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ensured = await ensureAccess(request, env);
  if (!ensured.ok) return json({ authed: false, reason: 'no cookie' }, 401);

  const res = await upstream(env, '/me', { method: 'GET' }, ensured.cookieHeader);
  const body = await res.text();

  const h = new Headers({ 'Content-Type': 'application/json' });
  if (ensured.setCookie) for (const sc of ensured.setCookie) h.append('Set-Cookie', sc);

  return new Response(body, { status: res.status, headers: h });
};
