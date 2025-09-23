// functions/api/whoami.ts
import { Env, json, getCookie, upstream, pickCookieFromSetCookie, forwardSetCookies } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Accept either site cookie or upstream cookie names
  const token =
    getCookie(request, "allstar_at") ||
    getCookie(request, "access_token");

  const out = new Headers({ "cache-control": "no-store" });

  // Try a few identity endpoints; prefer cookie style first
  const tryPaths = [
    { path: "/me", asCookie: true },
    { path: "/auth/me", asCookie: true },
    { path: "/session", asCookie: false },       // some workers return {user} here
    { path: "/auth/session", asCookie: false },
    { path: "/whoami", asCookie: true },
    { path: "/auth/whoami", asCookie: true },
  ];

  for (const t of tryPaths) {
    const headers: HeadersInit = t.asCookie && token ? { cookie: `access_token=${token}` } : {};
    const r = await upstream(env, t.path, { headers });
    forwardSetCookies(r, out); // bubble up any cookie updates
    if (r.ok) {
      // Normalize to {authed, me}
      const data = await r.json().catch(()=> ({}));
      const me = data?.me || data?.user || (data?.authed && data) || null;
      if (me) return json({ authed: true, me }, 200, out);
      // if endpoint returns a bare truthy flag
      if (data?.authed === true) return json({ authed: true, me: data?.user || data?.me || {} }, 200, out);
    }
    // keep trying
  }

  // No endpoint confirmed; if we had a token, consider unauthorized session
  if (!token) return json({ authed: false, reason: "no cookie" }, 200, out);
  return json({ authed: false, reason: "upstream denied" }, 200, out);
};
