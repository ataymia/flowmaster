// Proxies login to the Auth Worker and mirrors tokens into this domain's cookies.
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const body = await request.json().catch(() => ({}));

  const r = await fetch(`${env.AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const headers = new Headers({ 'content-type': 'application/json' });

  if (!r.ok) {
    const text = await r.text();
    return new Response(text, { status: r.status, headers });
  }

  // Worker returns tokens both in Set-Cookie and JSON body; use either.
  const setCookie = r.headers.get('set-cookie') || '';
  const mAccess = setCookie.match(/access_token=([^;]+)/);
  const mRefresh = setCookie.match(/refresh_token=([^;]+)/);

  const data = await r.json(); // { username, role, mustChangePassword, access, refresh }
  const accessToken  = (mAccess && mAccess[1])  || data.access  || null;
  const refreshToken = (mRefresh && mRefresh[1]) || data.refresh || null;

  if (accessToken)  headers.append('Set-Cookie', `allstar_at=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  if (refreshToken) headers.append('Set-Cookie', `allstar_rt=${refreshToken}; Path=/; HttpOnly; Secure; SameSite=Lax`);

  return new Response(JSON.stringify({
    ok: true,
    username: data.username,
    role: data.role,
    mustChangePassword: data.mustChangePassword
  }), { headers });
};
