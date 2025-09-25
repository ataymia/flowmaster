// functions/api/users.ts
import {
  type Env,
  proxyWithAuth,
} from "./_utils";

/**
 * Helper to map /api/... to backend /...
 *   /api/users            -> /users
 *   /api/users?role=AGENT -> /users?role=AGENT
 *   /api/users/123        -> /users/123
 */
function backendPath(req: Request) {
  const u = new URL(req.url);
  const suffix = u.pathname.replace(/^\/api/, "");
  return suffix + (u.search || "");
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // List users (admin/superadmin only)
  return proxyWithAuth(request, env, backendPath(request), {
    method: "GET",
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Create user; ensure JSON content-type even if caller forgot it
  const raw = await request.clone().text();
  return proxyWithAuth(request, env, backendPath(request), {
    method: "POST",
    body: raw,
    headers: { "content-type": "application/json" },
  });
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const raw = await request.clone().text();
  return proxyWithAuth(request, env, backendPath(request), {
    method: "PATCH",
    body: raw,
    headers: { "content-type": "application/json" },
  });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  return proxyWithAuth(request, env, backendPath(request), {
    method: "DELETE",
  });
};
