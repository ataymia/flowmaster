// functions/api/logout.ts
import { Env, upstream, clearCookie, forwardSetCookies } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const res = await upstream(env, "/auth/logout", { method: "POST" });
  const headers = new Headers();
  forwardSetCookies(res, headers);
  clearCookie(headers, "allstar_at", "/");
  clearCookie(headers, "allstar_rt", "/");
  return new Response(null, { status: res.status, headers });
};
