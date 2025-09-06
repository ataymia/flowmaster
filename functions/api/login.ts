// flowmaster/functions/api/login.ts
export const onRequestPost: PagesFunction = async (ctx) => {
  const { request, env } = ctx;
  const body = await request.json();

  // Forward login to your Auth Worker (now supports email or username)
  const r = await fetch(`${env.AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Pass through non-200s as-is so the UI can show error
  if (!r.ok) {
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { 'content-type': 'application/json' } });
  }

  // The worker sets Set-Cookie on ITS domain.
  // We mirror the access token onto OUR domain as `allstar_at` so middleware can protect /hub.
  const setCookieHeader = r.headers.get('set-cookie') || '';
  const accessMatch = setCookieHeader.match(/access_token=([^;]+)/);
  const accessToken = accessMatch ? accessMatch[1] : null;

  const headers = new Headers({ 'content-type': 'application/json' });

  if (accessToken) {
    // HttpOnly, Secure, SameSite=Lax to allow normal navigation; path=/
    headers.append(
      'Set-Cookie',
      `allstar_at=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
  }

  // Optional: also mirror refresh (not required for this step)
  const refreshMatch = setCookieHeader.match(/refresh_token=([^;]+)/);
  const refreshToken = refreshMatch ? refreshMatch[1] : null;
  if (refreshToken) {
    headers.append(
      'Set-Cookie',
      `allstar_rt=${refreshToken}; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
  }

  // Return the worker's body (username/role/etc) so UI could use it if needed
  const data = await r.json();
  return new Response(JSON.stringify({ ok: true, ...data }), { headers });
};
