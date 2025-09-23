import { Env, proxyWithAuth } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const u = new URL(request.url);
  const kind = (u.searchParams.get("kind") || "").toLowerCase();
  const from = u.searchParams.get("from") || "";
  const to   = u.searchParams.get("to")   || "";

  const path =
    kind === "schedules" ? `/export/schedules?from=${from}&to=${to}` :
    kind === "adherence" ? `/export/adherence?from=${from}&to=${to}` :
                           `/export/events?from=${from}&to=${to}`;

  return proxyWithAuth(request, env, path);
};
