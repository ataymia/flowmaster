// functions/api/refresh.ts
import { json, upstream, pickCookieFromSetCookie, Env } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cookie = request.headers.get("cookie") || "";
  const r = await upstream(env, "/auth/refresh", {
    method: "POST",
    headers: { cookie },
  });

  const h = new Headers();
  const set = r.headers.get("set-cookie");
  if (set) h.append("set-cookie", set);

  const body = await r.text();
  h.set("content-type", r.headers.get("content-type") || "application/json");
  return new Response(body, { status: r.status, headers: h });
};
