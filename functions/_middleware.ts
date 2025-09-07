// Protects /hub. Also supports one-time "?at=<token>" handoff to set the cookie
// if the browser didn't keep Set-Cookie from /api/login.

const PROTECTED = [/^\/hub(?:\/|$)/];

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

  if (!PROTECTED.some(rx => rx.test(url.pathname))) return next();

  const handoff = url.searchParams.get("at");
  let token = readCookie(request, "allstar_at");

  // If we have a one-time token in the URL, set cookie and clean the URL
  if (!token && handoff) {
    const h = new Headers();
    h.append("Set-Cookie", setCookie("allstar_at", handoff));
    url.searchParams.delete("at");
    h.set("Location", url.toString());
    return new Response(null, { status: 302, headers: h });
  }

  if (!token) return Response.redirect(new URL("/", url), 302);

  if (!env.AUTH_BASE) {
    console.error("Missing AUTH_BASE on Pages");
    return Response.redirect(new URL("/?err=auth-misconfig", url), 302);
  }

  const me = await fetch(`${env.AUTH_BASE}/me`, {
    headers: { Cookie: `access_token=${token}` }
  });

  if (!me.ok) return Response.redirect(new URL("/", url), 302);

  return next();
};
