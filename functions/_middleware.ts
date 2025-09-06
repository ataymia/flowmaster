// flowmaster/functions/_middleware.ts
const PROTECTED = [/^\/hub/];

export const onRequest: PagesFunction = async (ctx) => {
  const { request, env, next, cookies } = ctx;
  const url = new URL(request.url);

  if (!PROTECTED.some((r) => r.test(url.pathname))) return next();

  const token = cookies.get('allstar_at');
  if (!token) {
    return Response.redirect(new URL('/', url), 302);
  }

  // Verify with Auth Worker using its /me endpoint
  const meResp = await fetch(`${env.AUTH_BASE}/me`, {
    headers: { Cookie: `access_token=${token}` },
  });

  if (meResp.ok) {
    return next();
  }

  // Invalid/expired → back to login
  return Response.redirect(new URL('/', url), 302);
};
