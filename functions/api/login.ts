import { json, upstream, pickCookieFromSetCookie, ACCESS_NAME, REFRESH_NAME, Env } from './_utils';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const res = await upstream(env, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  });

  const setCookies: string[] = [];
  res.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') setCookies.push(v);
  });

  // Forward Set-Cookie so the browser actually stores tokens
  const h = new Headers({ 'Content-Type': 'application/json' });
  for (const sc of setCookies) h.append('Set-Cookie', sc);

  // Also include tokens in the body for Pages-functions to read if needed
  const access = pickCookieFromSetCookie(setCookies, ACCESS_NAME);
  const refresh = pickCookieFromSetCookie(setCookies, REFRESH_NAME);
  const bodyText = await res.text();
  let body: any;
  try { body = JSON.parse(bodyText); } catch { body = { raw: bodyText }; }

  return new Response(JSON.stringify({ ...body, access, refresh }), {
    status: res.status,
    headers: h,
  });
};
