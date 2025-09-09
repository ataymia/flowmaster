import {
  Env, json, upstream, forwardSetCookies, pickCookieFromSetCookie, setCookie, getCookie,
} from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Read our host-level refresh cookie and send it to the Auth worker
  const refresh = getCookie(request, "refresh_token");
  if (!refresh) return json({ error: "no_refresh" }, 401);

  const up = await upstream(env, "/auth/refresh", {
    method: "POST",
    headers: {
      // Send the cookie to the Auth worker domain
      cookie: `refresh_token=${refresh}`,
    },
    redirect: "manual",
  });

  const outHeaders = new Headers();
  forwardSetCookies(up, outHeaders);

  // Mirror the newly issued access_token back to our host cookies
  const access = pickCookieFromSetCookie(up.headers, "access_token");
  if (access) {
    setCookie(outHeaders, "allstar_at", access, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 15,
    });
    setCookie(outHeaders, "access_token", access, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 15,
    });
  }

  return new Response(null, { status: up.status, headers: outHeaders });
};
