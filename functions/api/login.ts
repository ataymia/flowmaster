// functions/api/login.ts
import { proxyWithAuth, setCookie } from './_utils';

export const onRequestPost: PagesFunction = async (ctx) => {
  // forward body to the Auth Worker
  const bodyText = await ctx.request.text();

  const res = await proxyWithAuth(ctx, '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: bodyText,
  });

  // We’ll add Set-Cookie for access/refresh on THIS host if tokens are included in JSON.
  const headers = new Headers(res.headers);

  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.clone().json();

      if (data?.access) {
        headers.append(
          'Set-Cookie',
          setCookie('access_token', data.access, {
            path: '/',
            sameSite: 'None',
            secure: true,
            httpOnly: true,
          })
        );
      }
      if (data?.refresh) {
        headers.append(
          'Set-Cookie',
          setCookie('refresh_token', data.refresh, {
            path: '/auth',
            sameSite: 'None',
            secure: true,
            httpOnly: true,
          })
        );
      }
    }
  } catch {
    // ignore parse errors; upstream Set-Cookie may still be present
  }

  return new Response(res.body, { status: res.status, headers });
};
