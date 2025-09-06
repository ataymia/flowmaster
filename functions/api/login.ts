// flowmaster/functions/api/login.ts
export const onRequestPost: PagesFunction = async (ctx) => {
  const { request, env } = ctx;
  const body = await request.json();

  // Forward (email, password) or (username, password) to your Auth Worker
  const r = await fetch(`${env.AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Pass through errors so the UI can show them
  if (!r.ok) {
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { 'content-type': 'application/json' } });
  }

  // Grab the access token from the worker's Set-Cookie
  const setCookie = r.headers.get('set-cookie') || '';
  const accessMatch = setCookie.match(/access_token=([^;]+)/);
  const accessToken = accessMatch ? accessMatch[1] : null;

  const headers = new Headers({ 'content-type': 'application/json' });
  if (accessToken) {
    headers.append('Set-Cookie', `allstar_at=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  }

  // Return worker body (username/role/mustChangePassword)
  const data = await r.json();
  return new Response(JSON.stringify({ ok: true, ...data }), { headers });
};
