import { hasSession } from "./api/_utils";

export const onRequest: PagesFunction = async (ctx) => {
  const { request, next } = ctx;
  const url = new URL(request.url);
  const p = url.pathname;

  // Always let APIs and static assets pass
  if (p.startsWith("/api/") || p.startsWith("/assets/")) {
    return next();
  }

  const loggedIn = hasSession(request);
  const needsAuth = p.startsWith("/hub") || p.startsWith("/adherence") || p.startsWith("/flowmaster");

  // If at root and logged in, go to hub
  if ((p === "/" || p === "/index.html") && loggedIn) {
    return Response.redirect(new URL("/hub", url).toString(), 302);
  }

  // If trying to view protected pages unauthenticated, go to sign-in
  if (needsAuth && !loggedIn) {
    return Response.redirect(new URL("/", url).toString(), 302);
  }

  return next();
};
