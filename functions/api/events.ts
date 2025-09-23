import { Env, ensureAccess, proxyWithSession } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  return proxyWithSession(request, env, "/events");
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  return proxyWithSession(request, env, "/events");
};
