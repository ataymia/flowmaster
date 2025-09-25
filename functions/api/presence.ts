import { type Env, proxyWithAuth, json } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Supports: /api/presence            (admin list)
  //           /api/presence?user=alice (self or specific user)
  const url = new URL(request.url);
  const q = url.search ? url.search : "";
  return proxyWithAuth(request, env, `/presence${q}`, { method: "GET" });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Optional: allow admin to set a user status heartbeat via the UI later
  return proxyWithAuth(request, env, `/presence/ping`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
};
