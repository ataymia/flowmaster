// functions/api/refresh.ts
import { Env, json, upstream, getCookie, setCookie, forwardSetCookies, pickCookieFromSetCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const rt = getCookie(request, "allstar_rt");
  if (!rt) return json({ error: "no_refresh" }, 401);

  const up = await upstream(env, "/auth/refresh", {
    method: "POST",
    headers: {
      "cookie": `refresh_token=${rt}`,
      "content-type": "application/json"
    },
  });

  const out = new Headers();
  forwardSetCookies(up, out);

  const access = pickCookieFromSetCookie(up.headers, "access_token");
  if (access) {
    setCookie(out, "allstar_at", access, {
      maxAge: 60 * 15,
      path: "/",
      sameSite: "Lax",
      secure: true,
      httpOnly: true,
    });
  }

  return new Response(null, { status: up.status, headers: out });
};
