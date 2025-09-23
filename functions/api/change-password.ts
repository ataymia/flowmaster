import { Env, ensureAccess, proxyWithAuth } from "./_utils";
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  return proxyWithAuth(request, env, "/auth/change-password");
};
