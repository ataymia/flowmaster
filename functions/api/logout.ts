import { Env, upstream, clearCookie, forwardSetCookies } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const res = await upstream(env, "/auth/logout", { method: "POST" });
  const headers = new Headers(res.headers);
  // clear site-local session too
  clearCookie(headers, "allstar_at", "/");
  forwardSetCookies(res.headers, headers);
  return new Response(res.body, { status: res.status, headers });
};
