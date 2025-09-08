export const config = {
  matcher: ['/*']
};

import type { Env } from './api/_utils';
import { parseCookies } from './api/_utils';

function redirect(url: string, setCookies?: string[]) {
  const h = new Headers({ Location: url });
  (setCookies || []).forEach(v => h.append('Set-Cookie', v));
  return new Response(null, { status: 302, headers: h });
}

export default async function Middleware(req: Request, env: Env, ctx: ExecutionContext) {
  const u = new URL(req.url);
  const p = u.pathname;

  // never touch API or static assets
  if (p.startsWith('/api/')) return;
  if (/\.[a-z0-9]+$/i.test(p)) return;

  // cookies
  const ck = req.headers.get('cookie') || '';
  const hasAccess  = ck.includes('access_token=') || ck.includes('allstar_at=');
  const hasRefresh = ck.includes('refresh_token=');

  // one-time marker cookie so UI can tell we’re “signed in”
  const set: string[] = [];
  if (hasRefresh && !ck.includes('allstar_at=')) {
    try {
      const r = await fetch(new URL('/api/refresh', u).toString(), {
        method: 'POST', headers: { cookie: ck },
      });
      const sc = (r as any).headers.getSetCookie?.()
        || r.headers.get('set-cookie')?.split(/\s*,\s*(?=access_token|refresh_token)/)
        || [];
      sc.forEach(v => set.push(v));
      set.push(`allstar_at=1; Max-Age=${60*60*24*7}; Path=/; SameSite=Lax; Secure`);
    } catch {}
  }

  // login
  if (p === '/' || p === '/index' || p === '/index/' || p === '/index.html') {
    if (hasAccess) return redirect('/hub', set);
    return set.length ? new Response(null, { status: 200, headers: new Headers({ 'Set-Cookie': set.join('\n') }) }) : undefined;
  }

  // hub
  if (p === '/hub' || p === '/hub/' || p === '/hub.html') {
    if (!hasAccess && !hasRefresh) return redirect('/');
    return set.length ? new Response(null, { status: 200, headers: new Headers({ 'Set-Cookie': set.join('\n') }) }) : undefined;
  }

  // protected areas
  if (p.startsWith('/adherence') || p.startsWith('/flowmaster')) {
    if (!hasAccess && !hasRefresh) return redirect('/');
    return set.length ? new Response(null, { status: 200, headers: new Headers({ 'Set-Cookie': set.join('\n') }) }) : undefined;
  }

  // everything else: pass through (maybe with the marker cookie)
  return set.length ? new Response(null, { status: 200, headers: new Headers({ 'Set-Cookie': set.join('\n') }) }) : undefined;
}
