import { Env, json, getCookie, upstream, forwardSetCookies, setCookie } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const out = new Headers({ "cache-control":"no-store" });

  const at = getCookie(request, "allstar_at") || getCookie(request, "access_token");
  const first = await tryMe(env, at);
  if (first.ok) return new Response(JSON.stringify({ authed:true, me: await first.json() }), { status:200, headers:out });

  // silent refresh using mirrored refresh cookie
  const rt = getCookie(request, "rt");
  if (!rt) return json({ authed:false, reason:"no tokens" }, 200, out);

  const ref = await upstream(env, "/auth/refresh", {
    method:"POST",
    headers:{ cookie:`refresh_token=${encodeURIComponent(rt)}` },
    redirect:"manual",
  });
  forwardSetCookies(ref, out);

  if (ref.status !== 204) return json({ authed:false, reason:"refresh_failed", status:ref.status }, 200, out);

  // If auth worker also returns the JWT body, mirror; if not, /me will still use the new Set-Cookie
  try {
    const j = await ref.clone().json();
    if (j?.access) setCookie(out, "allstar_at", j.access, { path:"/", httpOnly:true, secure:true, sameSite:"Lax", maxAge:60*60*24*7 });
  } catch {}

  const second = await tryMe(env, getCookie(new Request("http://x",{headers:out}), "allstar_at") || at);
  if (!second.ok) return json({ authed:false, reason:"me_failed_after_refresh", status:second.status }, 200, out);

  return new Response(JSON.stringify({ authed:true, me: await second.json() }), { status:200, headers:out });
};

async function tryMe(env: Env, access?: string | null) {
  if (!access) return new Response(null, { status:401 });
  return upstream(env, "/me", { headers:{ cookie:`access_token=${encodeURIComponent(access)}` } });
}
