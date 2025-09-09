import { Env, json, getCookie, upstream, forwardSetCookies, setCookie, pickCookieFromSetCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Use our mirrored rt cookie (path=/)
  const rt = getCookie(request, "rt");
  if (!rt) return json({}, 401, { "cache-control": "no-store" });

  // Call Auth Worker and attach the refresh cookie ourselves
  const up = await upstream(env, "/auth/refresh", {
    method: "POST",
    headers: { cookie: `refresh_token=${encodeURIComponent(rt)}` },
    redirect: "manual",
  });

  const out = new Headers({ "cache-control": "no-store" });
  forwardSetCookies(up, out);

  // Also refresh our mirror cookie so whoami stays happy
  const newAccess = pickCookieFromSetCookie(up, "access_token");
  if (newAccess) {
    setCookie(out, "allstar_at", newAccess, {
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });
  }

  return new Response(up.body, { status: up.status, headers: out });
};
