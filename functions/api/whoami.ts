import { Env, json, ensureAccess, upstream } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const gate = ensureAccess(request);
  if (!gate.ok) return gate.response;

  // Call /me with Cookie header (this is the most compatible with your worker)
  const res = await upstream(env, "/me", {
    headers: { cookie: `access_token=${gate.token}` }
  });

  if (!res.ok) return json({ error: "unauthorized" }, 401, { "cache-control": "no-store" });
  const me = await res.json();
  return json(me, 200, { "cache-control": "no-store" });
};
