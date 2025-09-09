// functions/api/export.ts
import { Env, ensureAccess, upstream, forwardSetCookies } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const acc = ensureAccess(request);
  if (!acc.ok) return acc.response;

  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") || "").toLowerCase();
  const from = url.searchParams.get("from") || "";
  const to   = url.searchParams.get("to")   || "";

  const path =
    kind === "events"    ? `/export/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  : kind === "schedules" ? `/export/schedules?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  : kind === "adherence" ? `/export/adherence?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  : null;

  if (!path) return new Response("bad kind", { status: 400 });

  const up = await upstream(env, path, {
    method: "GET",
    headers: { cookie: request.headers.get("cookie") || "" },
  });

  const headers = new Headers();
  // pass through CSV headers
  const cd = up.headers.get("content-disposition");
  const ct = up.headers.get("content-type");
  if (cd) headers.set("content-disposition", cd);
  if (ct) headers.set("content-type", ct);
  forwardSetCookies(up.headers, headers);
  return new Response(up.body, { status: up.status, headers });
};
