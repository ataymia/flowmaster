// functions/api/whoami.ts
import { json, parseCookies } from "./_utils";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  // Pages decides "signed-in" strictly by presence of access_token.
  const cookies = parseCookies(request);
  const access = cookies["access_token"];
  if (!access) return json({ error: "UNAUTHORIZED" }, 401);

  // If an external Auth Worker exists, confirm with it — but do not redirect.
  if (env.AUTH_BASE) {
    const r = await fetch(`${env.AUTH_BASE}/me`, {
      method: "GET",
      headers: { cookie: request.headers.get("cookie") || "" },
      redirect: "manual",
    });
    if (!r.ok) return json({ error: "UNAUTHORIZED" }, 401);

    const body = await r.text();
    const resp = new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    resp.headers.set("Vary", "Cookie");
    return resp;
  }

  // Fallback identity (keeps hub working even without upstream)
  return json({ username: "current", role: "AGENT" }, 200);
};
