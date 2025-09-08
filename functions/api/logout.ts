import { Env, json, forwardSetCookies, upstream } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const up = await upstream(request, env, "/auth/logout", { method: "POST" });
  const headers = new Headers();
  forwardSetCookies(up, headers);

  // Also actively clear our copies (belt & suspenders)
  headers.append("Set-Cookie", "access_token=; Path=/; Max-Age=0; SameSite=Lax");
  headers.append("Set-Cookie", "refresh_token=; Path=/; Max-Age=0; SameSite=Lax");

  return json({ ok: true }, { headers });
};
