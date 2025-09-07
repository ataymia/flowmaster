// Proxies login to the Auth Worker and mirrors tokens into this domain's cookies.
// Works with both AJAX (JSON) and native form posts (urlencoded). On success:
//  - AJAX: returns JSON { ok:true, ... } and the client redirects to /hub.
//  - Native form: returns 303 redirect to /hub.

function wantsHTML(req: Request): boolean {
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html') && !req.headers.get('x-ajax');
}

async function parseBody(req: Request): Promise<{ email?: string; username?: string; password?: string; }> {
  const ct = req.headers.get('content-type') || '';
  if (ct.startsWith('application/json')) {
    try { return await req.json(); } catch { return {}; }
  }
  // urlencoded fallback (native form)
  const raw = await req.text();
  try {
    const params = new URLSearchParams(raw);
    return {
      email: params.get('email') || undefined,
      username: params.get('username') || undefined,
      password: params.get('password') || undefined
    };
  } catch {
    return {};
  }
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const body = await parseBody(request);

  const r = await fetch(`${env.AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Prepare response headers for setting cookies on this domain
  const headers = new Headers({ 'content-type': 'application/json' });

  if (!r.ok) {
    const text = await r.text();
    if (wantsHTML(request)) {
      // Redirect back to / with an error code in query for native form UX
      const code = (() => { try { return JSON.parse(text).error; } catch { return 'login_error'; } })();
      const url = new URL('/', request.url);
      url.searchParams.set('err', code);
      return Response.redirect(url, 303);
    }
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

  if (wantsHTML(request)) {
    // Native form success → go straight to /hub
    const to = new URL('/hub', request.url);
    return new Response(null, { status: 303, headers: new Headers([...headers, ['Location', to.toString()]]) });
  }

  return new Response(JSON.stringify({
    ok: true,
    username: data.username,
    role: data.role,
    mustChangePassword: data.mustChangePassword
  }), { headers });
};
