import {
  json,
  upstream,
  setCookie,
  pickCookieFromSetCookie,
  ACCESS_NAME,
  REFRESH_NAME,
  Env,
} from './_utils';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Call the Auth Worker /auth/login with the same JSON body
  const upstreamRes = await upstream(env, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  });

  const raw = await upstreamRes.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch { data = {}; }

  // Try to get tokens from JSON body first (our worker returns them),
  // and fall back to parsing upstream Set-Cookie if needed.
  const setCookies: string[] = [];
  upstreamRes.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') setCookies.push(v);
  });

  let access = data.access as string | undefined;
  let refresh = data.refresh as string | undefined;
  if (!access)  access  = pickCookieFromSetCookie(setCookies, ACCESS_NAME) || undefined;
  if (!refresh) refresh = pickCookieFromSetCookie(setCookies, REFRESH_NAME) || undefined;

  // On the Pages domain set cookies with the RIGHT paths:
  // - access_token -> Path=/          (used by everything)
  // - refresh_token -> Path=/api      (only our API needs it)
  const h = new Headers({ 'Content-Type': 'application/json' });
  if (access) {
    h.append('Set-Cookie',
      setCookie(ACCESS_NAME, access, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 60 * 15, // 15 min
      })
    );
  }
  if (refresh) {
    h.append('Set-Cookie',
      setCookie(REFRESH_NAME, refresh, {
        path: '/api',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    );
  }

  if (!upstreamRes.ok) {
    // Forward error payload but still set any cookies we built (in case access arrived)
    return new Response(raw || JSON.stringify({ ok: false }), {
      status: upstreamRes.status,
      headers: h,
    });
  }

  // Minimal success body for the client
  return new Response(
    JSON.stringify({
      ok: true,
      username: data.username,
      role: data.role,
      mustChangePassword: !!data.mustChangePassword,
    }),
    { status: 200, headers: h }
  );
};
