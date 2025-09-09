import { Env, proxyWithAuth } from "./_utils";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  if (request.method === "POST" || url.pathname.endsWith("/ping")) {
    return proxyWithAuth(request, env, "/presence/ping", { method:"POST", body: request.body });
  }
  const qs = url.search || "";
  return proxyWithAuth(request, env, `/presence${qs}`, { method:"GET" });
};
