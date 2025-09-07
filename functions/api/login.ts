// Proxies login to the Auth Worker. Mirrors cookies and also includes a
// one-time URL handoff to guarantee session on /hub even if Set-Cookie is missed.
// For AJAX requests, it also echoes the token in JSON ("at") so you can test manually.

function wantsHTML(req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/html") && !req.headers.get("x-ajax");
}

async function parseBody(req: Request): Promise<{ email?: string; username?: string; password?: string; }> {
  const ct = req.headers.get("content-type") || "";
  if (ct.startsWith("application/json")) {
    try { return await req.json(); } catch { return {}; }
  }
  const raw = await req.text();
  try {
    const p = new URLSearchParams(raw);
    return { email: p.get("email") || undefined, username: p.get("username") || undefined, password: p.get("password") || undefined };
  } catch { return {}; }
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const body = await parseBody(request);

  const r = await fetch(`${env.AUTH_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const headers = new Headers({ "content-type": "application/json" });

  if (!r.ok) {
    const txt = await r.text();
    if (wantsHTML(request)) {
      const code = (() => { try { return JSON.parse(txt).error; } catch { return "login_error"; } })();
      const back = new URL("/", request.url); back.searchParams.set("err", code);
      return Response.redirect(back, 303);
    }
    return new Response(txt, { status: r.status, headers });
  }

  // pull tokens from Set-Cookie and/or JSON
  const sc = r.headers.get("set-cookie") || "";
  const mA = sc.match(/access_token=([^;]+)/);
  const mR = sc.match(/refresh_token=([^;]+)/);
  const data = await r.json(); // { username, role, mustChangePassword, access, refresh }

  const access = (mA && mA[1]) || data.access || "";
  const refresh = (mR && mR[1]) || data.refresh || "";

  if (access)  headers.append("Set-Cookie", `allstar_at=${access}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  if (refresh) headers.append("Set-Cookie", `allstar_rt=${refresh}; Path=/; HttpOnly; Secure; SameSite=Lax`);

  if (wantsHTML(request)) {
    // handoff in case browser drops Set-Cookie during 303
    const to = new URL("/hub", request.url);
    if (access) to.searchParams.set("at", access);
    headers.set("Location", to.toString());
    return new Response(null, { status: 303, headers });
  }

  // AJAX path returns token too (useful for manual test)
  return new Response(JSON.stringify({
    ok: true,
    username: data.username,
    role: data.role,
    mustChangePassword: data.mustChangePassword,
    at: access
  }), { headers });
};
