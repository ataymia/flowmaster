// functions/api/events.ts
import { proxyWithAuth, Env } from "./_utils";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  return proxyWithAuth(request, env, "/events");
};
