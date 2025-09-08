import { Env, json, upstream } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const up = await upstream(request, env, "/me", { method: "GET" });
  const data = await up.clone().json().catch(() => ({}));
  if (!up.ok) return json({ ok: false }, { status: up.status });
  return json({ ok: true, user: data });
};
