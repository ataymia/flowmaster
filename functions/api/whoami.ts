import { Env, json, getCookie, upstream } from "./_utils";

// Back-compat: your Hub expects { authed, me }
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  // Try either cookie name
  const token = getCookie(request, "allstar_at") || getCookie(request, "access_token");

  // If no token, try to refresh using our host refresh cookie
  if (!token) {
    const up = await upstream(env, "/auth/refresh", {
      method: "POST",
      headers: { cookie: `refresh_token=${getCookie(request, "refresh_token") || ""}` },
      redirect: "manual",
    });
    if (up.status !== 204) {
      return json({ authed: false, reason: "no session" });
    }
    // We don’t get the new token body here; the login page will fetch again and cookies will be present
  }

  // We call /me at the Auth worker; it accepts Cookie access_token
  const access = getCookie(request, "allstar_at") || getCookie(request, "access_token");
  if (!access) return json({ authed: false, reason: "no token after refresh" });

  const r = await fetch(`${env.AUTH_BASE}/me`, {
    headers: { Cookie: `access_token=${access}` },
  });

  if (!r.ok) return json({ authed: false, status: r.status });
  const me = await r.json().catch(() => ({}));

  return json({ authed: true, me });
};
