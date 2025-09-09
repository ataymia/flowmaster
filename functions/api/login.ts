import {
  Env, json, upstream, forwardSetCookies, pickCookieFromSetCookie, setCookie,
} from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Pass through body/headers to the auth worker
  const up = await upstream(env, "/auth/login", {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type") || "application/json" },
    body: request.body,
    redirect: "manual",
  });

  // Prepare outgoing headers, forward upstream Set-Cookie as-is
  const outHeaders = new Headers({ "content-type": up.headers.get("content-type") || "application/json" });
  forwardSetCookies(up, outHeaders);

  // Mirror tokens to Pages host cookies so our site can see them
  const access = pickCookieFromSetCookie(up.headers, "access_token");
  const refresh = pickCookieFromSetCookie(up.headers, "refresh_token");

  if (access) {
    // Keep backwards-compat for /api/whoami (reads allstar_at)
    setCookie(outHeaders, "allstar_at", access, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 15, // 15m (match worker default)
    });
    // Also mirror access_token at host level so newer code can read it
    setCookie(outHeaders, "access_token", access, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 15,
    });
  }
  if (refresh) {
    // Important: keep a host-level copy so /api/refresh can send it upstream
    setCookie(outHeaders, "refresh_token", refresh, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 7, // 7d
    });
  }

  const body = await up.text().catch(() => "");
  return new Response(body, { status: up.status, headers: outHeaders });
};
