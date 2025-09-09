import { Env, proxyWithAuth } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  return proxyWithAuth(request, env, "/auth/change-password", { method:"POST", body: request.body });
};
