import { Env, proxyWithAuth } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  // /api/export?type=events|schedules|adherence&from=...&to=...&user=...
  const type = url.searchParams.get("type") || "events";
  const qs = url.search || "";
  return proxyWithAuth(request, env, `/export/${type}${qs.replace(/^\?/, '?')}`, { method:"GET" });
};
