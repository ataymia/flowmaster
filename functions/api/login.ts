import { Env, upstream, forwardSetCookies, setCookie } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // forward body + content-type
  const body = await request.text();
  const headers = new Headers();
  const ct = request.headers.get("content-type"); if (ct) headers.set("content-type", ct);

  const up = await upstream(env, "/auth/login", { method:"POST", headers, body, redirect:"manual" });

  // Clone body so we can both read JSON (for mirrors) and forward
  const clone = up.clone();
  const out = new Headers({ "cache-control": "no-store" });

  // 1) forward upstream Set-Cookie lines
  forwardSetCookies(up, out);

  // 2) also mirror tokens from JSON body (belt & suspenders)
  try {
    const j = await clone.json();
    if (j?.access) {
      setCookie(out, "allstar_at", j.access, { path:"/", httpOnly:true, secure:true, sameSite:"Lax", maxAge:60*60*24*7 });
    }
    if (j?.refresh) {
      setCookie(out, "rt", j.refresh, { path:"/", httpOnly:true, secure:true, sameSite:"Lax", maxAge:60*60*24*7 });
    }
  } catch {}

  return new Response(up.body, { status: up.status, headers: out });
};
