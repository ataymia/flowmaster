// functions/api/logout.ts
import { copySetCookies } from './_utils';

export const onRequestPost: PagesFunction<{ AUTH_BASE: string }> = async ({ request, env }) => {
  if (!env.AUTH_BASE) return new Response('{"error":"AUTH_BASE not configured"}', { status: 500, headers: { 'content-type': 'application/json' } });

  const upstream = await fetch(new URL('/auth/logout', env.AUTH_BASE).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await request.text().catch(() => null),
    redirect: 'manual',
  });
  const res = new Response(upstream.body, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/json', 'Vary': 'Cookie' } });
  copySetCookies(upstream.headers, res.headers);
  const origin = new URL(request.url).origin;
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  return res;
};

export const onRequestGet = onRequestPost;
