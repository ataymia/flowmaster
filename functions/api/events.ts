// functions/api/events.ts
import { proxyWithAuth, Env } from "./_utils";

/**
 *  GET  /api/events?user=:u&from=:ms&to=:ms  -> GET  /events?...
 *  POST /api/events                           -> POST /events (body {status, ts})
 */

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  return proxyWithAuth(request, env, `/events${url.search || ""}`);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  return proxyWithAuth(request, env, "/events", {
    method: "POST",
    body: await request.clone().text(),
  });
};
