// Guards Hub, Schedule, Flowmaster. If access token is expired, it tries a
// one-time refresh using the refresh token cookie, then proceeds without
// bouncing the user to login. Also supports "?at=<token>" handoff.

const PROTECTED = [
  /^\/hub(?:\/|$)/,
  /^\/adherence(?:\/|$)/,
  /^\/flowmaster(?:\/|$)/,
];

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

function setCookie(name: string, val: string): string {
  return `${name}=${val}; Path=/; Secure; SameSite=Lax`;
}

export const onRequest: PagesFunction = async (ctx) => {
  const { request, env, next } = ctx;
  const url = new URL(request.url);

  // Only guard app routes
  if (!PROTECTED.some(rx => rx.test(url.pathname))) return next();

  // Optional one-time handoff: /path?at=<token>
  const handoff = url.searchParams.get("at");
  let access = readCookie(request, "allstar_at");

  if (!access && handoff) {
    const h = new Headers();
    h.append("Set-Cookie", setCookie("allstar_at", handoff));
    url.searchParams.delete("at");
    h.set("Location", url.toString());
    return new Response(null, { status: 302, headers: h });
  }

  if (!env.AUTH_BASE) {
    console.error("Missing AUTH_BASE on Pages");
    return Response.redirect(new URL("/?err=auth-misconfig", url), 302);
  }

  // If we have an access token, verify it
  if (access) {
    const me = await fetch(`${env.AUTH_BASE}/me`, {
      headers: { Cookie: `access_token=${access}` }
    });

    if (me.ok) return next();

    // Expired/invalid? Try refresh with refresh token cookie
    const refreshTok = readCookie(request, "allstar_rt");
    if (refreshTok) {
      const rr = await fetch(`${env.AUTH_BASE}/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `refresh_token=${refreshTok}` }
      });

      if (rr.ok) {
        // Worker now returns { ok:true, access }
        let j:any = {};
        try { j = await rr.json(); } catch {}
        const newAccess = j.access;
        if (newAccess) {
          const h = new Headers();
          h.append("Set-Cookie", setCookie("allstar_at", newAccess));
          h.set("Location", url.toString()); // retry original URL
          return new Response(null, { status: 302, headers: h });
        }
      }
    }
  }

  // No access and/or no refresh possible -> login
  return Response.redirect(new URL("/", url), 302);
};
