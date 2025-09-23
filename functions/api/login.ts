import { Env, upstream, forwardSetCookies, pickCookieFromSetCookie, setCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.text();
  const headers = new Headers(); const ct = request.headers.get("content-type"); if (ct) headers.set("content-type", ct);

  const up = await upstream(env, "/auth/login", { method: "POST", headers, body, redirect: "manual" });

  const out = new Headers({ "cache-control": "no-store" });
  forwardSetCookies(up, out);

  const access = pickCookieFromSetCookie(up, "access_token");
  if (access) setCookie(out, "allstar_at", access, { path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 * 60 * 24 * 7 });

  const refresh = pickCookieFromSetCookie(up, "refresh_token");
  if (refresh) setCookie(out, "rt", refresh, { path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 * 60 * 24 * 7 });

  return new Response(up.body, { status: up.status, headers: out });
};
