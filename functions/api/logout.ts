// functions/api/logout.ts
import { proxyWithAuth, setCookie, json } from './_utils';

export const onRequestPost: PagesFunction = async (ctx) => {
  // call upstream to clear server-side state if any
  await proxyWithAuth(ctx, '/auth/logout', { method: 'POST' });

  // clear both cookies on this host
  const h = new Headers();
  h.append(
    'Set-Cookie',
    setCookie('access_token', '', { path: '/', sameSite: 'None', secure: true, httpOnly: true, maxAge: 0 })
  );
  h.append(
    'Set-Cookie',
    setCookie('refresh_token', '', { path: '/auth', sameSite: 'None', secure: true, httpOnly: true, maxAge: 0 })
  );
  return json({ ok: true }, 200, h);
};
