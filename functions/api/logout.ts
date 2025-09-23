// functions/api/logout.ts
import { Env, upstream, clearCookie, forwardSetCookies } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  // Try standard logout routes
  const routes = ["/auth/logout", "/logout", "/auth/signout"];
  let last: Response | null = null;

  for (const r of routes) {
    const res = await upstream(env, r, { method: "POST" });
    last = res;
    if (res.status < 500) break;
  }

  const headers = new Headers();
  if (last) forwardSetCookies(last, headers);
  clearCookie(headers, "allstar_at", "/");
  clearCookie(headers, "allstar_rt", "/");
  return new Response(null, { status: last ? last.status : 200, headers });
};
