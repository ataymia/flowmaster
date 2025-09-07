import { clearCookie, json } from './_utils';

export async function onRequestPost() {
  const h = new Headers({ 'content-type': 'application/json' });
  h.append('Set-Cookie', clearCookie('access_token',  '/'));
  h.append('Set-Cookie', clearCookie('refresh_token', '/'));
  return new Response(null, { status: 204, headers: h });
}
