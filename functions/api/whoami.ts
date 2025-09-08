import { json, ensureAccess, upstream, Env } from './_utils';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ensured = await ensureAccess(request, env);
  if (!ensured.access) {
    return json({ authed: false, reason: 'no token' }, 401);
  }

  const res = await upstream(env, '/me', {
    headers: { Authorization: `Bearer ${ensured.access}` },
  });

  // If upstream fails for any reason, forward useful info
  const h = new Headers();
  ensured.set.forEach((s) => h.append('Set-Cookie', s));

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return json({ authed: false, error: t || 'whoami_failed' }, res.status, h);
  }

  const me = await res.json();
  return json(
    {
      id: me.id,
      username: me.username,
      role: me.role,
      mustChangePassword: !!me.mustChangePassword,
    },
    200,
    h
  );
};
