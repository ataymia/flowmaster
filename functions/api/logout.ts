import { Env, upstream, forwardSetCookies, clearCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const up = await upstream(env, "/auth/logout", { method: "POST", redirect: "manual" });

  const out = new Headers({ "cache-control": "no-store" });
  forwardSetCookies(up, out);
  // also clear our mirrors
  clearCookie(out, "allstar_at", "/");
  clearCookie(out, "rt", "/");

  return new Response(null, { status: 204, headers: out });
};
