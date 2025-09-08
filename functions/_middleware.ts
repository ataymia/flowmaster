// functions/_middleware.ts
export const onRequest: PagesFunction = async (ctx) => {
  const { request, next } = ctx;
  const url = new URL(request.url);
  const p = url.pathname;

  // Never gate APIs or static assets
  if (p.startsWith('/api/')) return next();

  // Normalize /hub/ -> /hub (one-time, not a loop)
  if (p === '/hub/') return Response.redirect(`${url.origin}/hub`, 301);

  // Gate the hub by access_token only
  if (p === '/hub') {
    const cookies = request.headers.get('cookie') || '';
    const hasAccess = /(?:^|;\s*)access_token=/.test(cookies);
    if (!hasAccess) return Response.redirect(`${url.origin}/`, 302);
    return next();
  }

  // Everything else (/, /flowmaster/, /adherence/, static) just pass through
  return next();
};
