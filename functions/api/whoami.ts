// functions/api/whoami.ts
import { json, upstream, Env } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const cookie = request.headers.get("cookie") || "";
  // try /me
  let r = await upstream(env, "/me", { headers: { cookie } });

  // if unauthorized and we have a refresh cookie, try refresh then /me again
  if (r.status === 401 && /refresh_token=/.test(cookie)) {
    const ref = await upstream(env, "/auth/refresh", { method: "POST", headers: { cookie } });
    const h = new Headers();
    const set = ref.headers.get("set-cookie");
    if (set) h.append("set-cookie", set);

    // Try /me again
    r = await upstream(env, "/me", { headers: { cookie: set ? set.split(";")[0] : cookie } });

    // Pass any new cookies back
    const body = await r.text();
    h.set("content-type", r.headers.get("content-type") || "application/json");
    return new Response(body, { status: r.status, headers: h });
  }

  const body = await r.text();
  const h = new Headers();
  h.set("content-type", r.headers.get("content-type") || "application/json");
  return new Response(body, { status: r.status, headers: h });
};
