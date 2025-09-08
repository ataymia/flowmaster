// functions/_middleware.ts
// Protect app sections; never redirect the login page (/).

const GATED_PREFIXES = ['/hub', '/adherence', '/flowmaster'];

function hasTokenCookie(req: Request) {
  const c = req.headers.get('cookie') || '';
  // Accept either cookie; access_token is normal, refresh_token lets the page refresh on load
  return /(?:^|;\s*)(access_token|refresh_token)=/.test(c);
}

function isGated(pathname: string) {
  return GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const onRequest: PagesFunction[] = [
  async ({ request, next }) => {
    const url = new URL(request.url);
    const { pathname } = url;

    // Don’t interfere with APIs
    if (pathname.startsWith('/api/')) return next();

    // Login page must never redirect (prevents loop)
    if (pathname === '/' || pathname === '/index.html') return next();

    // Only protect the app surfaces
    if (isGated(pathname)) {
      if (!hasTokenCookie(request)) {
        return Response.redirect(new URL('/', url), 302);
      }
      // user has a token → allow through
      return next();
    }

    return next();
  },
];
