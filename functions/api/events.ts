import { Env, proxyWithAuth } from "./_utils";

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "POST") return proxyWithAuth(request, env, "/events", { method:"POST", body: request.body });
  // GET list
  const url = new URL(request.url);
  const qs = url.search ? url.search : "";
  return proxyWithAuth(request, env, `/events${qs}`, { method:"GET" });
};
