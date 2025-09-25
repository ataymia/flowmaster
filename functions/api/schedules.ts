// functions/api/schedules.ts
import { proxyWithAuth, Env } from "./_utils";

/**
 *  GET  /api/schedules?user=:u&date=:d  -> GET  /schedules?user=:u&date=:d
 *  POST /api/schedules                  -> POST /schedules (body {username,date,blocks})
 */

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const search = url.search || "";
  return proxyWithAuth(request, env, `/schedules${search}`);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  return proxyWithAuth(request, env, "/schedules", {
    method: "POST",
    body: await request.clone().text(),
  });
};
