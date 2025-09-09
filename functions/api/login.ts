import { Env, json, upstream, setCookie, forwardSetCookies } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Pass body to upstream /auth/login
  const res = await upstream(env, "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });

  const dataText = await res.text();
  let body: any = null;
  try { body = JSON.parse(dataText); } catch { /* leave as text */ }

  // Mirror upstream cookies AND set a site-local session cookie for our Pages domain
  const headers = new Headers({ "content-type": res.headers.get("content-type") || "application/json" });
  forwardSetCookies(res.headers, headers);

  // If the upstream body has "access", pin it to our own cookie so /api/whoami etc can use it reliably.
  if (body && body.access) {
    setCookie(headers, "allstar_at", body.access, { maxAge: 60*15, sameSite: "Lax", path: "/" });
  }

  return new Response(body ? JSON.stringify(body) : dataText, { status: res.status, headers });
};
