// functions/api/schedules.ts
import { Env, ensureAccess, json, proxyWithSession } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;

  const u = new URL(request.url);
  const qs = u.search ? u.search : '';
  return proxyWithSession(request, env, `/schedules${qs}`);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;

  return proxyWithSession(request, env, `/schedules`);
};
