// functions/api/export.ts
import { Env, ensureAccess, proxyWithSession, json } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = ensureAccess(request);
  if (!auth.ok) return auth.response;

  const u = new URL(request.url);
  const kind = (u.searchParams.get("kind") || "").toLowerCase();
  const from = u.searchParams.get("from") || "";
  const to   = u.searchParams.get("to") || "";
  const user = u.searchParams.get("user") || "";

  let target = "";
  if (kind === "events")     target = `/export/events`;
  else if (kind === "schedules") target = `/export/schedules`;
  else if (kind === "adherence") target = `/export/adherence`;
  else return json({ error: "bad kind" }, 400);

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to)   qs.set("to", to);
  if (user) qs.set("user", user);
  const path = qs.toString() ? `${target}?${qs}` : target;

  // Proxy; content-type (text/csv) and disposition pass through
  return proxyWithSession(request, env, path);
};
