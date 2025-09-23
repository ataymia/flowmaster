import { Env, proxyWithAuth } from "./_utils";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === "POST") {
    return proxyWithAuth(request, env, "/schedules", { method: "POST", body: request.body });
  }
  const url = new URL(request.url);
  const qs = url.search ? url.search : "";
  return proxyWithAuth(request, env, `/schedules${qs}`, { method: "GET" });
};
