// functions/api/login.ts
import { Env, upstream, setCookie, forwardSetCookies, pickCookieFromSetCookie, safeJson } from "./_utils";

/**
 * Robust login: tries multiple worker routes and mirrors tokens into first-party cookies.
 * Accepts either {email,password} or {username,password} from the page; we send both.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const bodyText = await request.text();
  // Try a few common auth routes in order
  const candidates = ["/auth/login", "/login", "/auth/signin"];

  let lastRes: Response | null = null;
  for (const path of candidates) {
    const res = await upstream(env, path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bodyText,
      redirect: "manual",
    });
    lastRes = res;
    if (res.status < 400) break; // success-ish
  }

  if (!lastRes) {
    return new Response(JSON.stringify({ error: "no_response" }), {
      status: 502, headers: { "content-type":"application/json" }
    });
  }

  // Mirror any Set-Cookie from worker
  const out = new Headers({ "content-type":"application/json" });
  forwardSetCookies(lastRes, out);

  // Also mirror into site cookies if the worker used different names or JSON tokens
  const access =
    pickCookieFromSetCookie(lastRes.headers, "access_token") ||
    pickCookieFromSetCookie(lastRes.headers, "access");
  const refresh =
    pickCookieFromSetCookie(lastRes.headers, "refresh_token") ||
    pickCookieFromSetCookie(lastRes.headers, "refresh") ||
    pickCookieFromSetCookie(lastRes.headers, "rt");

  // If tokens provided in JSON body, grab them as a fallback
  const jsonBody = await safeJson<any>(lastRes);
  const accessFromJson = jsonBody?.access_token || jsonBody?.access;
  const refreshFromJson = jsonBody?.refresh_token || jsonBody?.refresh || jsonBody?.rt;

  const accessFinal = access || accessFromJson;
  const refreshFinal = refresh || refreshFromJson;

  if (accessFinal) {
    setCookie(out, "allstar_at", accessFinal, {
      maxAge: 60 * 15, path: "/", sameSite: "Lax", secure: true, httpOnly: true,
    });
  }
  if (refreshFinal) {
    setCookie(out, "allstar_rt", refreshFinal, {
      maxAge: 60 * 60 * 24 * 7, path: "/", sameSite: "Lax", secure: true, httpOnly: true,
    });
  }

  const txt = jsonBody ? JSON.stringify(jsonBody) : await lastRes.text().catch(()=> "{}");
  return new Response(txt || "{}", { status: lastRes.status, headers: out });
};
