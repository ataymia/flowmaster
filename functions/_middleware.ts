// functions/_middleware.ts
// Do NOT gate pages here. Never redirect based on cookies.
// Only pass through and add a few safe headers.

export const onRequest: PagesFunction = async ({ request, next }) => {
  const url = new URL(request.url);

  // Just render the requested asset/route
  const res = await next();

  // Clone so we can tweak headers
  const out = new Response(res.body, res);

  // Make sure different cookie states don't get cached together
  out.headers.set('Vary', 'Cookie');

  // Prevent CDN/browser from caching HTML shells (avoids sticky 302s forever)
  const path = url.pathname;
  const isHtmlShell =
    path === '/' ||
    path === '/hub' ||
    path.startsWith('/adherence') ||
    (!path.includes('.') && !path.startsWith('/api/'));
  if (isHtmlShell) out.headers.set('Cache-Control', 'no-store');

  // Basic security hardening (optional)
  out.headers.set('X-Frame-Options', 'SAMEORIGIN');
  out.headers.set('X-Content-Type-Options', 'nosniff');

  return out;
};
