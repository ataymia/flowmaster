// functions/_middleware.ts
/**
 * Gatekeep only the protected routes and never auto-redirect "/" anywhere.
 * This removes the / ↔ /hub ping-pong loop while keeping /hub, /adherence,
 * and /flowmaster protected.
 */

type PagesCtx = {
  request: Request;
  next: () => Promise<Response>;
};

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export const onRequest = async ({ request, next }: PagesCtx) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Never intercept your server functions.
  if (path.startsWith("/api/")) return next();

  // Only these paths require auth.
  const needsAuth =
    path.startsWith("/hub") ||
    path.startsWith("/adherence") ||
    path.startsWith("/flowmaster");

  if (!needsAuth) {
    // "/" and public pages just render. No auto-redirects.
    return next();
  }

  // A valid session exists if either token is present.
  const hasAccess = !!readCookie(request, "access_token");
  const hasRefresh = !!readCookie(request, "refresh_token");

  if (hasAccess || hasRefresh) {
    return next();
  }

  // Not authenticated → send to login (root). No infinite loops.
  const to = new URL("/", url);
  return Response.redirect(to, 302);
};
