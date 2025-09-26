// Proxies heartbeat pings to the Auth Worker

import { type Env, proxyWithAuth } from "../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.text(); // stream-safe clone
  const ct = request.headers.get("content-type") || "application/json";
  return proxyWithAuth(request, env, `/presence/ping`, {
    method: "POST",
    headers: { "content-type": ct },
    body,
  });
};

// Optionally guard other methods
export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  // If your Pages runtime prefers the method-specific export above, this fallback
  // will never run for POST. It's here just to keep non-POSTs tidy.
  return new Response("Method Not Allowed", { status: 405 });
};
