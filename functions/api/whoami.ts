// functions/api/whoami.ts
import { json, parseCookies } from './_utils';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  // Minimal gating: require an access cookie
  const cookies = parseCookies(request);
  const access = cookies['access_token'];
  if (!access) return json({ error: 'UNAUTHORIZED' }, 401);

  // If you have an upstream auth worker, verify there:
  if (env.AUTH_BASE) {
    const me = await fetch(`${env.AUTH_BASE}/me`, {
      method: 'GET',
      headers: { cookie: request.headers.get('cookie') || '' },
      redirect: 'manual',
    });

    if (!me.ok) return json({ error: 'UNAUTHORIZED' }, 401);

    // Forward JSON body from upstream /me
    const body = await me.text();
    const resp = new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    resp.headers.set('Vary', 'Cookie');
    return resp;
  }

  // Fallback: return a simple identity; keeps the hub working even if you
  // prefer not to proxy to AUTH_BASE.
  return json({ username: 'current', role: 'AGENT' }, 200);
};
