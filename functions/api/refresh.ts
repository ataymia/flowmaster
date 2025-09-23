import { Env, json, getCookie, upstream, forwardSetCookies, setCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const rt = getCookie(request, "rt");
  if (!rt) return json({}, 401, { "cache-control":"no-store" });

  const up = await upstream(env, "/auth/refresh", {
    method:"POST",
    headers:{ cookie:`refresh_token=${encodeURIComponent(rt)}` },
    redirect:"manual",
  });

  const out = new Headers({ "cache-control":"no-store" });
  forwardSetCookies(up, out);

  // also keep our mirror aligned
  try {
    // some deployments return 204 with Set-Cookie only; if body absent, skip
    const txt = await up.clone().text();
    if (txt) {
      const j = JSON.parse(txt);
      if (j?.access) setCookie(out, "allstar_at", j.access, { path:"/", httpOnly:true, secure:true, sameSite:"Lax", maxAge:60*60*24*7 });
    }
  } catch {}
  return new Response(up.body, { status: up.status, headers: out });
};
