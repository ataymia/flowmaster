// functions/api/presence.ts
import { type Env, proxyWithAuth } from "./_utils";

/**
 * GET /api/presence
 *  - Admin: list all users with presence
 *  - Agent: returns own presence (Worker enforces)
 * GET /api/presence?user=<username>  - specific user
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const q = url.search || "";
  return proxyWithAuth(request, env, `/presence${q}`, { method: "GET" });
};

/**
 * POST /api/presence
 *  - Heartbeat or an optional {status, ts}
 *  - We forward to /presence/ping on the Worker
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.text();
  return proxyWithAuth(request, env, `/presence/ping`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
};
