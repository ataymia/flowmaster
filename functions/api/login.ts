import { Env, json, forwardSetCookies, upstream } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const body = await request.json().catch(() => ({}));
  const up = await upstream(request, env, "/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = await up.clone().json().catch(() => ({}));
  const headers = new Headers();
  forwardSetCookies(up, headers);
  headers.set("cache-control", "no-store");

  if (!up.ok) {
    return json({ ok: false, error: data?.error || "login_failed" }, { status: up.status, headers });
  }
  return json({ ok: true, user: data?.username || data?.user || null }, { headers });
};
