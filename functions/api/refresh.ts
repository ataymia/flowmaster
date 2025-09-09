// functions/api/refresh.ts
import {
  Env,
  json,
  upstream,
  getCookie,
  setCookie,
  forwardSetCookies,
  pickCookieFromSetCookie,
} from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const rt = getCookie(request, "allstar_rt");
  if (!rt) return json({ error: "no_refresh" }, 401);

  // Ask the auth worker to mint a new access token
  const up = await upstream(env, "/auth/refresh", {
    method: "POST",
    headers: { cookie: `refresh_token=${rt}` },
    redirect: "manual",
  });

  const outHeaders = new Headers();
  forwardSetCookies(up, outHeaders); // surface any worker cookies

  // Copy the new access token into our first-party cookie for the hub
  const access = pickCookieFromSetCookie(up.headers, "access_token");
  if (access) {
    setCookie(outHeaders, "allstar_at", access, {
      maxAge: 60 * 15,
      path: "/",
      sameSite: "Lax",
      secure: true,
      httpOnly: true,
    });
  }

  return new Response(null, { status: up.status, headers: outHeaders });
};
