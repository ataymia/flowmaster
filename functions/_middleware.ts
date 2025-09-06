import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROTECTED = [/^\/hub/];

export const onRequest: PagesFunction = async (ctx) => {
  const { request, env, next, cookies } = ctx;
  const url = new URL(request.url);

  if (!PROTECTED.some(r => r.test(url.pathname))) return next();

  const access = cookies.get('allstar_at');
  if (!access) return Response.redirect(new URL('/', url), 302);

  const jwks = createRemoteJWKSet(new URL(env.JWKS_URL));
  try {
    await jwtVerify(access, jwks, { audience: 'allstar-agent-hub' });
    return next();
  } catch {
    return Response.redirect(new URL('/', url), 302);
  }
};

