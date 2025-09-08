// Light gate: protect app pages from anonymous access
import { parseCookies } from './_utils';

const PUBLIC_PATHS = new Set([
  '/',                 // login
  '/favicon.ico',
  '/theme.css',
]);
const PUBLIC_API_PREFIXES = ['/api/login', '/api/refresh', '/api/logout', '/api/debug', '/api/notion-check', '/api/debug-auth', '/api/debug-news'];

export const onRequest: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  const { pathname } = url;

  // Static public
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) {
    return ctx.next();
  }

  // Protect hub/adherence (and anything under /adherence)
  if (pathname === '/hub' || pathname.startsWith('/adherence')) {
    const c = parseCookies(ctx.request);
    if (!c['access_token'] && !c['refresh_token']) {
      return Response.redirect(`${url.origin}/`, 302);
    }
  }

  return ctx.next();
};
