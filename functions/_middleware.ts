// functions/_middleware.ts
// Gate app routes by presence of the access/refresh cookie.
// Never auto-redirect / (login). Only protect the app pages.

const GATED_PREFIXES = ['/hub', '/adherence', '/flowmaster'];

function hasTokenCookie(req: Request) {
  const c = req.headers.get('cookie') || '';
  // accept either cookie; access_token is the normal case,
  // but allow refresh_token so the page JS can refresh on load.
  return /(?:^|;\s*)(access_token|refresh_token)=/.test(c);
}

function isGatedPath(pathname: string) {
  return GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const onRequest = [
  async (ctx: any) => {
    const url = new URL(ctx.request.url);
    const { pathname } = url;

    // 1) Don’t touch API routes.
    if (pathname.startsWith('/api/')) {
      // Add minimal CORS for your own origin + worker preview
      const res = await ctx.next();
      const h = new Headers(res.headers);
      // same-origin requests don’t need CORS, but this is harmless
      h.set('Vary', 'Origin');
      return new Response(res.body, { status: res.status, headers: h });
    }

    // 2) LOGIN page must NEVER redirect anywhere (prevents loops)
    if (pathname === '/' || pathname === '/index.html') {
      return ctx.next();
    }

    // 3) Protect app surfaces
    if (isGatedPath(pathname)) {
      if (!hasTokenCookie(ctx.request)) {
        // not signed in → go to login
        return Response.redirect(new URL('/', url), 302);
      }
      // signed in → allow through
      return ctx.next();
    }

    // 4) Everything else just passes through
    return ctx.next();
  },
];
