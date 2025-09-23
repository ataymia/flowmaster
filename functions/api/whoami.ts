import { Env, json, getCookie, upstream, forwardSetCookies, setCookie, pickCookieFromSetCookie } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const out = new Headers({ "cache-control": "no-store" });

  const at = getCookie(request, "allstar_at") || getCookie(request, "access_token");
  let res = at
    ? await upstream(env, "/me", { headers: { cookie: `access_token=${encodeURIComponent(at)}` } })
    : new Response(null, { status: 401 });

  if (res.ok) {
    return new Response(JSON.stringify({ authed: true, me: await res.json() }), { status: 200, headers: out });
  }

  const rt = getCookie(request, "rt");
  if (!rt) return json({ authed: false, reason: "no tokens" }, 200, out);

  const ref = await upstream(env, "/auth/refresh", {
    method: "POST",
    headers: { cookie: `refresh_token=${encodeURIComponent(rt)}` },
    redirect: "manual",
  });
  forwardSetCookies(ref, out);
  if (ref.status !== 204) return json({ authed: false, reason: "refresh_failed", status: ref.status }, 200, out);

  const newAccess = pickCookieFromSetCookie(ref, "access_token");
  if (newAccess) setCookie(out, "allstar_at", newAccess, { path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 * 60 * 24 * 7 });

  res = await upstream(env, "/me", { headers: { cookie: `access_token=${encodeURIComponent(newAccess || "")}` } });
  if (!res.ok) return json({ authed: false, reason: "me_failed_after_refresh", status: res.status }, 200, out);

  return new Response(JSON.stringify({ authed: true, me: await res.json() }), { status: 200, headers: out });
};
