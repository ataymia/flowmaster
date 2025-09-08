// functions/api/whoami.ts
import { json, parseCookies } from './_utils';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const cookies = parseCookies(request);
  const access = cookies['access_token'];
  if (!access) return json({ error: 'UNAUTHORIZED' }, 401);

  // Verify with upstream Auth Worker (no redirects)
  if (env.AUTH_BASE) {
    const me = await fetch(`${env.AUTH_BASE}/me`, {
      method: 'GET',
      headers: { cookie: request.headers.get('cookie') || '' },
      redirect: 'manual',
    });
    if (!me.ok) return json({ error: 'UNAUTHORIZED' }, 401);
    const body = await me.text();
    const resp = new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    resp.headers.set('Vary', 'Cookie');
    return resp;
  }

  // Fallback identity if no upstream (keeps UI working)
  return json({ username: 'current', role: 'AGENT' }, 200);
};
