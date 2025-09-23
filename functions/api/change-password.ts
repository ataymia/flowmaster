import { Env, proxyWithAuth, ensureAccess } from "./_utils";
export const onRequestPost: PagesFunction<Env> = async (c) => {
  const acc = ensureAccess(c.request); if (!acc.ok) return acc.response;
  return proxyWithAuth(c.request, c.env, "/auth/change-password");
};
