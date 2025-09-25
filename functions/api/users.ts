// functions/api/users.ts
import { proxyWithAuth, Env, json } from "./_utils";

/**
 * Routes handled here (proxied to the Worker):
 *  GET    /api/users               ->  GET  /users
 *  GET    /api/users?role=AGENT    ->  GET  /users?role=AGENT
 *  POST   /api/users               ->  POST /users
 *  PATCH  /api/users/:id           ->  PATCH /users/:id
 *  DELETE /api/users/:id           ->  DELETE /users/:id
 */

function workerPath(req: Request) {
  const url = new URL(req.url);
  // Extract optional ":id" after /api/users/
  const match = url.pathname.match(/^\/api\/users(?:\/([^/]+))?\/?$/);
  const id = match?.[1];
  const search = url.search || "";
  return id ? `/users/${id}${search}` : `/users${search}`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  return proxyWithAuth(request, env, workerPath(request));
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  return proxyWithAuth(request, env, "/users", {
    method: "POST",
    body: await request.clone().text(), // forward raw body
  });
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const path = workerPath(request);
  if (!/\/users\/[^/?#]+/.test(path)) {
    return json({ error: "missing user id" }, 400);
  }
  return proxyWithAuth(request, env, path, {
    method: "PATCH",
    body: await request.clone().text(),
  });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const path = workerPath(request);
  if (!/\/users\/[^/?#]+/.test(path)) {
    return json({ error: "missing user id" }, 400);
  }
  return proxyWithAuth(request, env, path, { method: "DELETE" });
};
