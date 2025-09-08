// functions/_middleware.ts
// Never redirect here. Only pass through and add safe headers.

export const onRequest: PagesFunction = async ({ request, next }) => {
  const url = new URL(request.url);

  // Let the requested page/asset render.
  const res = await next();

  // Clone to modify headers.
  const out = new Response(res.body, res);

  // Split caches by cookie (auth vs anon).
  out.headers.set("Vary", "Cookie");

  // Ensure shells aren't cached; avoids sticky redirect loops in caches.
  const p = url.pathname;
  const isHtmlShell =
    p === "/" ||
    p === "/hub" ||
    p.startsWith("/adherence") ||
    (!p.includes(".") && !p.startsWith("/api/"));

  if (isHtmlShell) out.headers.set("Cache-Control", "no-store");

  // Small hardening
  out.headers.set("X-Frame-Options", "SAMEORIGIN");
  out.headers.set("X-Content-Type-Options", "nosniff");

  return out;
};
