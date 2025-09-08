import { Env, json, forwardSetCookies, upstream } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const up = await upstream(request, env, "/auth/refresh", { method: "GET" });
  const headers = new Headers();
  forwardSetCookies(up, headers);

  if (!up.ok) return json({ ok: false }, { status: up.status, headers });
  return json({ ok: true }, { headers });
};
