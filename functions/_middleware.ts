// functions/_middleware.ts
// No auth or redirects here. Just pass through and add safe headers.

export const onRequest: PagesFunction = async ({ request, next }) => {
  const url = new URL(request.url);

  // Render whatever was asked for
  const res = await next();

  // Clone so we can tweak headers
  const out = new Response(res.body, res);

  // Split caches by cookie (auth vs anon)
  out.headers.set('Vary', 'Cookie');

  // Prevent HTML shells from being cached (avoids sticky 302 forever)
  const p = url.pathname;
  const isHtmlShell =
    p === '/' ||
    p === '/hub' ||
    p.startsWith('/adherence') ||
    (!p.includes('.') && !p.startsWith('/api/'));
  if (isHtmlShell) out.headers.set('Cache-Control', 'no-store');

  // Hardening
  out.headers.set('X-Frame-Options', 'SAMEORIGIN');
  out.headers.set('X-Content-Type-Options', 'nosniff');

  return out;
};
