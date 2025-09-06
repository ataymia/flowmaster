// flowmaster/functions/_middleware.ts
const PROTECTED = [/^\/hub/];

export const onRequest: PagesFunction = async (ctx) => {
  const { request, env, next, cookies } = ctx;
  const url = new URL(request.url);

  // Only guard protected paths
  if (!PROTECTED.some((r) => r.test(url.pathname))) return next();

  // Require our mirrored cookie
  const token = cookies.get('allstar_at');
  if (!token) {
    return Response.redirect(new URL('/', url), 302);
  }

  // Server-side verify by calling the Auth Worker /me with the access token as a cookie
  const meResp = await fetch(`${env.AUTH_BASE}/me`, {
    headers: {
      // Present the token as the worker expects it: access_token cookie
      'Cookie': `access_token=${token}`,
    },
  });

  if (meResp.ok) {
    // Optionally, you could stash the user into a request header for downstream usage
    return next();
  }

  // Invalid/expired token → back to login
  return Response.redirect(new URL('/', url), 302);
};
