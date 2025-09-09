// functions/api/change-password.ts
import { Env, ensureAccess, proxyWithSession } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;

  // Auth Worker exposes /auth/change-password
  return proxyWithSession(request, env, "/auth/change-password");
};
