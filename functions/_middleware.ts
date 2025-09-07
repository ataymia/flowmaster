// Protects /hub. Fully defensive: no reliance on ctx.cookies, safe fallbacks.
const PROTECTED = [/^\/hub(\/|$)/];

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

export const onRequest: PagesFunction = async (ctx) => {
  const { request, env, next } = ctx;
  const url = new URL(request.url);

  try {
    // Only guard /hub
    if (!PROTECTED.some(r => r.test(url.pathname))) return next();

    // 1) Require our mirrored cookie from /api/login
    const token = readCookie(request, "allstar_at");
    if (!token) {
      return Response.redirect(new URL("/", url), 302);
    }

    // 2) Verify the session with the Auth Worker
    if (!env.AUTH_BASE) {
      console.error("Missing AUTH_BASE env var on Pages.");
      // Fail safe: bounce to login instead of 500
      return Response.redirect(new URL("/?err=auth-misconfig", url), 302);
    }

    const meResp = await fetch(`${env.AUTH_BASE}/me`, {
      headers: { Cookie: `access_token=${token}` },
    });

    if (meResp.ok) {
      return next();
    }

    // Token invalid/expired -> login
    return Response.redirect(new URL("/", url), 302);
  } catch (err) {
    // Never throw to user; log and send to login
    console.error("middleware error", err);
    return Response.redirect(new URL("/", url), 302);
  }
};
