// functions/api/presence.ts
import { Env, ensureAccess, proxyWithSession, json } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const user = url.searchParams.get("user");
  const path = user ? `/presence?user=${encodeURIComponent(user)}` : `/presence`;
  return proxyWithSession(request, env, path);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;
  // Forward to /presence/ping with body
  return proxyWithSession(request, env, "/presence/ping");
};
