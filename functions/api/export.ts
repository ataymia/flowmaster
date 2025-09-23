import { Env, ensureAccess, proxyWithAuth, json } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const g = ensureAccess(request); if (!g.ok) return g.response;
  const u = new URL(request.url);
  const kind = (u.searchParams.get("kind") || "").toLowerCase();
  const from = u.searchParams.get("from") || "";
  const to   = u.searchParams.get("to") || "";

  const path =
    kind === "events"    ? `/export/events?from=${from}&to=${to}` :
    kind === "schedules" ? `/export/schedules?from=${from}&to=${to}` :
    kind === "adherence" ? `/export/adherence?from=${from}&to=${to}` :
    null;

  if (!path) return json({ error: "bad kind" }, 400);
  return proxyWithAuth(request, env, path);
};
