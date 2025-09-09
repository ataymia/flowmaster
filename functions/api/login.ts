import {
  Env, json, upstream, forwardSetCookies,
  pickCookieFromSetCookie, setCookie
} from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // pass through body as-is (supports JSON or form)
  const body = await request.text();
  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const up = await upstream(env, "/auth/login", {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });

  // Forward upstream cookies + also mirror for Pages usage.
  const out = new Headers({ "cache-control": "no-store" });
  forwardSetCookies(up, out);

  // Mirror access_token -> allstar_at (HttpOnly, path=/)
  const access = pickCookieFromSetCookie(up, "access_token");
  if (access) {
    setCookie(out, "allstar_at", access, {
      maxAge: 60 * 60 * 24 * 7, // keep a week; actual JWT still expires but we’ll refresh
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });
  }

  // Mirror refresh_token -> rt (HttpOnly, path=/), so Pages Functions can refresh
  const refresh = pickCookieFromSetCookie(up, "refresh_token");
  if (refresh) {
    setCookie(out, "rt", refresh, {
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });
  }

  return new Response(up.body, { status: up.status, headers: out });
};
