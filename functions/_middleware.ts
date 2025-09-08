// functions/_middleware.ts
export const onRequest = async ({ request, next }: { request: Request; next: () => Promise<Response> }) => {
  // Always allow API and static files (css, js, images, favicon, etc.)
  const url = new URL(request.url);
  const p = url.pathname;

  if (
    p.startsWith("/api/") ||
    p.startsWith("/assets/") ||
    p.startsWith("/public/") ||
    p.startsWith("/_worker/") ||
    p.match(/\.(css|js|mjs|json|png|jpg|jpeg|gif|svg|ico|webp|map)$/)
  ) {
    return next();
  }

  // Login page is always public
  const isLoginPage = p === "/" || p === "/index.html";
  // These routes require auth cookies
  const needsAuth =
    p === "/hub" ||
    p === "/hub.html" ||
    p.startsWith("/adherence") ||
    p.startsWith("/flowmaster");

  // Parse cookies
  const cookie = request.headers.get("cookie") || "";
  const hasAccess = /access_token=/.test(cookie) || /refresh_token=/.test(cookie);

  // Auth flow:
  // - If user is authenticated and at "/" -> send to hub (but never loop)
  if (isLoginPage && hasAccess) {
    return Response.redirect(new URL("/hub", url), 302);
  }

  // - If route needs auth and user has no cookies -> go to login
  if (needsAuth && !hasAccess) {
    // Avoid loop by never redirecting when we're already at "/"
    return Response.redirect(new URL("/", url), 302);
  }

  // Default: let the request through
  const res = await next();

  // Make protected pages non-cacheable
  if (needsAuth) {
    const h = new Headers(res.headers);
    h.set("cache-control", "no-store, private");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }

  return res;
};
