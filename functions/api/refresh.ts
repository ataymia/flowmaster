// functions/api/refresh.ts
import { proxyWithAuth, setCookie } from './_utils';

export const onRequestPost: PagesFunction = async (ctx) => {
  const res = await proxyWithAuth(ctx, '/auth/refresh', { method: 'POST' });

  const headers = new Headers(res.headers);

  // If upstream returns a JSON body with a new access token, set it here too.
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
    }
  } catch {
    // ignore
  }

  return new Response(res.body, { status: res.status, headers });
};
