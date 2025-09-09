// functions/api/users.ts
import { Env, ensureAccess, proxyWithSession } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;
  return proxyWithSession(request, env, `/users${new URL(request.url).search}`);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;
  return proxyWithSession(request, env, `/users`);
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;
  const id = new URL(request.url).pathname.split('/').pop()!;
  return proxyWithSession(request, env, `/users/${id}`);
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;
  const id = new URL(request.url).pathname.split('/').pop()!;
  return proxyWithSession(request, env, `/users/${id}`);
};
