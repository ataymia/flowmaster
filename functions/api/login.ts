export const onRequestPost: PagesFunction = async (ctx) => {
  const { request, env } = ctx;
  const body = await request.json();

  const r = await fetch(`${env.AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    return new Response(await r.text(), { status: r.status });
  }

  const data = await r.json(); // { access, refresh }
  const headers = new Headers({ 'content-type': 'application/json' });
  const cookieBase = 'Path=/; HttpOnly; Secure; SameSite=Lax';

  headers.append('Set-Cookie', `allstar_at=${data.access}; ${cookieBase}`);
  headers.append('Set-Cookie', `allstar_rt=${data.refresh}; ${cookieBase}`);

  return new Response(JSON.stringify({ ok: true }), { headers });
};

