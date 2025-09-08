// functions/api/login.ts
// Proxy login to the Auth Worker and forward Set-Cookie so cookies land on the Pages domain.

function allow(h: Headers) {
  // Basic CORS allowance for XHR; same-origin fetches don't need it but harmless
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'content-type');
  h.set('Access-Control-Max-Age', '600');
}

export const onRequestOptions: PagesFunction = async () => {
  const h = new Headers();
  allow(h);
  return new Response(null, { status: 204, headers: h });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!env.AUTH_BASE) {
    return new Response(JSON.stringify({ error: 'AUTH_BASE not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Your Worker’s path is /auth/login (not /login)
  const upstream = await fetch(`${env.AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await request.text(),
    credentials: 'include',
    redirect: 'manual',
  });

  // Proxy body/status
  const out = new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      Vary: 'Cookie',
    },
  });

  // Forward ALL Set-Cookie headers so cookies are set on staragentdash.work
  const anyHeaders = upstream.headers as any;
  const setCookies: string[] =
    typeof anyHeaders.getSetCookie === 'function'
      ? anyHeaders.getSetCookie()
      : upstream.headers.get('set-cookie')
      ? [upstream.headers.get('set-cookie') as string]
      : [];

  for (const v of setCookies) out.headers.append('Set-Cookie', v);

  allow(out.headers);
  return out;
};

// Fallback (safety)
export const onRequestGet: PagesFunction = async () =>
  new Response('Use POST /api/login', { status: 405 });
