import { Env, json, upstream, setCookie, forwardSetCookies, pickCookieFromSetCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const res = await upstream(env, "/auth/refresh", { method: "POST" });

  // Clone headers and forward any upstream Set-Cookie
  const headers = new Headers(res.headers);
  forwardSetCookies(res.headers, headers);

  // If upstream rotated access_token, mirror into our site-local cookie
  const newAccess = pickCookieFromSetCookie(res.headers, "access_token");
  if (newAccess) setCookie(headers, "allstar_at", newAccess, { maxAge: 60*15, sameSite: "Lax", path: "/" });

  if (res.status === 204) return new Response(null, { status: 204, headers });
  const txt = await res.text();
  try { return new Response(txt, { status: res.status, headers }); }
  catch { return json({}, res.status, headers); }
};
