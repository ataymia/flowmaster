import { upstream, Env } from './_utils';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const res = await upstream(env, '/auth/logout', { method: 'POST' }, request.headers.get('cookie') || '');
  // Just forward what upstream sends (Set-Cookie clearing)
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
};
