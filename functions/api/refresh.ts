// functions/api/refresh.ts
import { Env, json, upstream, getCookie, setCookie, forwardSetCookies, pickCookieFromSetCookie, safeJson } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const rt = getCookie(request, "allstar_rt") || getCookie(request, "refresh_token") || "";
  if (!rt) return json({ error: "no_refresh" }, 401);

  // Try a few common refresh endpoints
  const candidates = ["/auth/refresh", "/refresh", "/auth/token"];
  let last: Response | null = null;

  for (const path of candidates) {
    const res = await upstream(env, path, {
      method: "POST",
      headers: { "cookie": `refresh_token=${rt}`, "content-type":"application/json" },
    });
    last = res;
    if (res.status < 400) break;
  }
  if (!last) return json({ error: "no_response" }, 502);

  const out = new Headers();
  forwardSetCookies(last, out);

  // Mirror access token into site cookie
  const access =
    pickCookieFromSetCookie(last.headers, "access_token") ||
    pickCookieFromSetCookie(last.headers, "access");
  const jsonBody = await safeJson<any>(last);
  const accessFromJson = jsonBody?.access_token || jsonBody?.access;
  const accessFinal = access || accessFromJson;

  if (accessFinal) {
    setCookie(out, "allstar_at", accessFinal, {
      maxAge: 60 * 15, path: "/", sameSite: "Lax", secure: true, httpOnly: true,
    });
  }

  return new Response(null, { status: last.status, headers: out });
};
