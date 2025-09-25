// functions/api/users/[id].ts
import { type Env, proxyWithAuth, safeJson, json } from "../_utils";

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = String(params?.id || "").trim();
  if (!id) return json({ error: "missing_id" }, 400);

  // Accept only the keys your Worker supports
  const incoming = await safeJson(request) as any;
  if (!incoming || (incoming.role === undefined && incoming.mustChangePassword === undefined)) {
    return json({ error: "nothing_to_update" }, 400);
  }

  const out: any = {};
  if (incoming.role !== undefined) {
    out.role = String(incoming.role).toUpperCase();
  }
  if (incoming.mustChangePassword !== undefined) {
    out.mustChangePassword = !!incoming.mustChangePassword;
  }

  return proxyWithAuth(request, env, `/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(out),
  });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = String(params?.id || "").trim();
  if (!id) return json({ error: "missing_id" }, 400);

  return proxyWithAuth(request, env, `/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
};
