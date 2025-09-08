// functions/_middleware.ts
// Protects app routes without causing loops or runtime errors.

import { parseCookies } from './api/_utils';

const PUBLIC_PATHS = new Set<string>([
  '/', '/index.html', '/favicon.ico', '/robots.txt', '/manifest.json'
]);

const PUBLIC_API_PREFIXES = [
  '/api/login',
  '/api/logout',
  '/api/refresh',
  '/api/whoami',
  '/api/news',
];

const PROTECTED_PREFIXES = [
  '/hub',        // covers /hub and /hub.html if you redirect to it
  '/hub.html',   // direct file
  '/adherence',  // /adherence and /adherence/
  '/flowmaster', // /flowmaster and /flowmaster/
];

export const onRequest: PagesFunction = async (ctx) => {
  const { request, next } = ctx;
  const url = new URL(request.url);
  const { pathname } = url;

  // Allow public static pages and assets
  if (PUBLIC_PATHS.has(pathname)) return next();

  // Allow public API endpoints
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) return next();

  // Only guard protected areas
  const needsAuth = PROTECTED_PREFIXES.some(p =>
    pathname === p || pathname.startsWith(p)
  );
  if (!needsAuth) return next();

  // Check for auth cookies
  const c = parseCookies(request);
  const hasAccess = !!c.get('access_token') || !!c.get('refresh_token');
  if (!hasAccess) {
    url.pathname = '/index.html';
    return Response.redirect(url.toString(), 302);
  }

  return next();
};
