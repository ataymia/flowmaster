// Proxies presence GET (and POST fallback) to the Auth Worker

import { type Env, proxyWithAuth } from "./_utils";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);

  // GET /api/presence?user=jane
  if (request.method === "GET") {
    return proxyWithAuth(request, env, `/presence${url.search}`, { method: "GET" });
  }

  // Optional fallback: if anything POSTs to /api/presence, send it to /presence/ping
  if (request.method === "POST") {
    const body = await request.text(); // stream-safe clone
    const ct = request.headers.get("content-type") || "application/json";
    return proxyWithAuth(request, env, `/presence/ping`, {
      method: "POST",
      headers: { "content-type": ct },
      body,
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
