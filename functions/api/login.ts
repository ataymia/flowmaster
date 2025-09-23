import { Env, upstream, setCookie, forwardSetCookies, pickCookieFromSetCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.text();
  const up = await upstream(env, "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    redirect: "manual",
  });

  const out = new Headers({ "content-type": "application/json" });
  forwardSetCookies(up, out);

  // Mirror tokens into first-party cookies so pages.dev can read them
  const access = pickCookieFromSetCookie(up.headers, "access_token");
  if (access) setCookie(out, "allstar_at", access, { maxAge: 60 * 15, path: "/", sameSite: "Lax", secure: true, httpOnly: true });
  const refresh = pickCookieFromSetCookie(up.headers, "refresh_token");
  if (refresh) setCookie(out, "allstar_rt", refresh, { maxAge: 60 * 60 * 24 * 7, path: "/", sameSite: "Lax", secure: true, httpOnly: true });

  const text = await up.text().catch(()=>"{}");
  return new Response(text, { status: up.status, headers: out });
};
