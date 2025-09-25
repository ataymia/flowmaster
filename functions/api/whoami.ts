// functions/api/whoami.ts
import { type Env, json, getCookie, upstream } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Prefer the Pages session cookie; fall back to Worker cookie
  const token =
    getCookie(request, "allstar_at") || getCookie(request, "access_token");

  if (!token) {
    return json({ authed: false, reason: "no_cookie" }, 200, {
      "cache-control": "no-store",
    });
  }

  // Ask the Auth Worker who we are, passing the token as a cookie
  const res = await upstream(env, "/me", {
    method: "GET",
    headers: { cookie: `access_token=${token}` },
    redirect: "manual",
  });

  // Normalize output for the frontend
  if (res.ok) {
    const me = await res.json().catch(() => ({}));
    return json({ authed: true, me }, 200, { "cache-control": "no-store" });
  }

  // 401 = not logged in / expired; otherwise surface status for diagnostics
  return json(
    { authed: false, status: res.status },
    200,
    { "cache-control": "no-store" }
  );
};
