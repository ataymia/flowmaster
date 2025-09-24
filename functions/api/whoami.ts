// functions/api/whoami.ts
import { Env, json, getCookie, upstream } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Prefer our Pages session cookie; fall back to worker cookie if present
  const token =
    getCookie(request, "allstar_at") || getCookie(request, "access_token");
  if (!token) {
    return json({ authed: false, reason: "no cookie" }, 200, {
      "cache-control": "no-store",
    });
  }

  // Call the worker using the token as a cookie (what /me expects)
  const r = await upstream(env, "/me", {
    headers: { cookie: `access_token=${token}` },
  });

  if (!r.ok) {
    return json({ authed: false, status: r.status }, 200, {
      "cache-control": "no-store",
    });
  }
  const me = await r.json().catch(() => ({}));
  return json({ authed: true, me }, 200, { "cache-control": "no-store" });
};
