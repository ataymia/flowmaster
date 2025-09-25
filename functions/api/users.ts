// functions/api/users.ts
import { type Env, proxyWithAuth, safeJson, json } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Pass through to Worker /users (admins/SAs only, enforced by Worker)
  return proxyWithAuth(request, env, "/users", { method: "GET" });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Accept a few shapes and normalize to Worker shape
  const incoming = await safeJson(request) as any;
  if (!incoming) return json({ error: "bad_json" }, 400);

  const username =
    (incoming.username ?? incoming.email ?? "").toString().toLowerCase().trim();
  const role = (incoming.role ?? "AGENT").toString().toUpperCase().trim();
  const password =
    (incoming.password ??
      incoming.tempPassword ??
      "").toString();

  if (!username) return json({ error: "username_required" }, 400);
  if (!password) return json({ error: "password_required" }, 400);

  const body = JSON.stringify({ username, role, password });

  return proxyWithAuth(request, env, "/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
};
