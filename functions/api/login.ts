// functions/api/login.ts
import { copySetCookies } from './_utils';

function allow(h: Headers, origin: string) {
  h.set('Access-Control-Allow-Origin', origin);
  h.set('Access-Control-Allow-Credentials', 'true');
  h.set('Access-Control-Allow-Headers', 'content-type');
  h.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

export const onRequestOptions: PagesFunction = async ({ request }) => {
  const h = new Headers();
  allow(h, new URL(request.url).origin);
  return new Response(null, { status: 204, headers: h });
};

export const onRequestPost: PagesFunction<{ AUTH_BASE: string }> = async ({ request, env }) => {
  if (!env.AUTH_BASE) return new Response('{"error":"AUTH_BASE not configured"}', { status: 500, headers: { 'content-type': 'application/json' } });

  const upstream = await fetch(new URL('/auth/login', env.AUTH_BASE).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await request.text(),
    redirect: 'manual',
  });

  const res = new Response(upstream.body, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/json', 'Vary': 'Cookie' } });
  copySetCookies(upstream.headers, res.headers);
  allow(res.headers, new URL(request.url).origin);
  return res;
};
