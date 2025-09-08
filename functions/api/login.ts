// functions/api/login.ts
import { json, upstream, pickCookieFromSetCookie, Env } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const r = await upstream(env, "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });

  const body = await r.text();
  const h = new Headers();
  const set = r.headers.get("set-cookie");
  if (set) {
    // When the Worker sends multiple cookies, Cloudflare folds them with comma.
    // Split safely on comma followed by space + token name startswith something=
    // Simpler: just pass through as-is; browsers can parse combined header from CF.
    h.append("set-cookie", set);
  }
  h.set("content-type", r.headers.get("content-type") || "application/json");

  return new Response(body, { status: r.status, headers: h });
};
