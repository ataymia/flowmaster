// functions/api/logout.ts
import { json, upstream, Env } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cookie = request.headers.get("cookie") || "";
  const r = await upstream(env, "/auth/logout", {
    method: "POST",
    headers: { cookie },
  });

  const h = new Headers();
  const set = r.headers.get("set-cookie");
  if (set) h.append("set-cookie", set);
  return json({ ok: true }, 200, h);
};
