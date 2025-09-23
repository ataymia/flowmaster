import { Env, ensureAccess, proxyWithSession, json } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  return proxyWithSession(request, env, "/users");
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  return proxyWithSession(request, env, "/users");
};
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  const id = (params as any)?.id || request.url.split("/").pop();
  if (!id) return json({ error: "missing id" }, 400);
  return proxyWithSession(request, env, `/users/${id}`);
};
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  const id = (params as any)?.id || request.url.split("/").pop();
  if (!id) return json({ error: "missing id" }, 400);
  return proxyWithSession(request, env, `/users/${id}`);
};
