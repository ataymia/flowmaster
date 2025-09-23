import {
  Env, json, getCookie, upstream, forwardSetCookies,
  pickCookieFromSetCookie, setCookie
} from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Accept either cookie; prefer our mirror
  let at = getCookie(request, "allstar_at") || getCookie(request, "access_token");
  let res = await tryMe(env, at);
  const out = new Headers({ "cache-control": "no-store" });

  if (res.ok) {
    return new Response(JSON.stringify({ authed: true, me: await res.json() }), {
      status: 200, headers: out
    });
  }

  // Try a silent refresh using our mirrored refresh cookie
  const rt = getCookie(request, "rt");
  if (!rt) {
    return json({ authed: false, reason: "no tokens" }, 200, out);
  }

  const ref = await upstream(env, "/auth/refresh", {
    method: "POST",
    headers: { cookie: `refresh_token=${encodeURIComponent(rt)}` },
    redirect: "manual",
  });
  forwardSetCookies(ref, out);

  if (ref.status !== 204) {
    return json({ authed: false, reason: "refresh_failed", status: ref.status }, 200, out);
  }

  // Update our mirror cookie from refresh
  const newAccess = pickCookieFromSetCookie(ref, "access_token");
  if (newAccess) {
    setCookie(out, "allstar_at", newAccess, {
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });
    at = newAccess;
  }

  // Try /me again with the new token
  res = await tryMe(env, at);
  if (!res.ok) {
    return json({ authed: false, reason: "me_failed_after_refresh", status: res.status }, 200, out);
  }

  return new Response(JSON.stringify({ authed: true, me: await res.json() }), {
    status: 200, headers: out
  });
};

async function tryMe(env: Env, access?: string | null) {
  if (!access) return new Response(null, { status: 401 });
  return upstream(env, "/me", {
    method: "GET",
    headers: { cookie: `access_token=${encodeURIComponent(access)}` },
  });
}
