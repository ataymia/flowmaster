import { Env, ensureAccess, proxyWithSession } from "./_utils";
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  return proxyWithSession(request, env, "/presence");
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  // allow POST to /api/presence to map to /presence/ping
  return proxyWithSession(request, env, "/presence/ping");
};
