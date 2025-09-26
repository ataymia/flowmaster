// GET /api/schedule-templates
// POST /api/schedule-templates  { name, blocks:[{status,start,end}] }
// DELETE /api/schedule-templates/:id
import { type Env, proxyWithAuth } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  proxyWithAuth(request, env, "/schedule-templates", { method: "GET" });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) =>
  proxyWithAuth(request, env, "/schedule-templates", { method: "POST", body: request.body });

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const id = new URL(request.url).pathname.split("/").pop();
  return proxyWithAuth(request, env, `/schedule-templates/${id}`, { method: "DELETE" });
};
