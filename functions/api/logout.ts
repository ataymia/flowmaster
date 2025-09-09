import { Env, upstream, forwardSetCookies, clearCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const up = await upstream(env, "/auth/logout", { method: "POST", redirect: "manual" });

  const outHeaders = new Headers();
  forwardSetCookies(up, outHeaders); // clears upstream cookies

  // Clear our host-level mirrors
  clearCookie(outHeaders, "allstar_at");
  clearCookie(outHeaders, "access_token");
  clearCookie(outHeaders, "refresh_token");

  return new Response(null, { status: 204, headers: outHeaders });
};
