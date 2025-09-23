// functions/api/debug-auth.ts
import { Env, json, upstream, getCookie } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const base = (env as any)?.AUTH_BASE || "FALLBACK:https://allstar-auth.ataymia.workers.dev";
  const token = getCookie(request, "allstar_at") || getCookie(request, "access_token") || null;

  // probe a few URLs
  async function ping(path: string, useToken = true) {
    try {
      const headers: HeadersInit = {};
      if (useToken && token) headers["cookie"] = `access_token=${token}`;
      const r = await upstream(env, path, { headers });
      const ct = r.headers.get("content-type") || "";
      const body = ct.includes("json") ? await r.json().catch(()=>({})) : await r.text();
      return { status: r.status, ok: r.ok, body };
    } catch (e: any) {
      return { error: String(e?.message || e) };
    }
  }

  const probes = {
    base,
    tokenPresent: !!token,
    me: await ping("/me", true),
    auth_me: await ping("/auth/me", true),
    session: await ping("/session", false),
    auth_session: await ping("/auth/session", false),
    health: await ping("/health", false),
  };

  return json(probes, 200, { "cache-control":"no-store" });
};
