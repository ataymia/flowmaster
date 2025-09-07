function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const token = readCookie(request, "allstar_at");
  if (!token) {
    return new Response(JSON.stringify({ authed: false, reason: "no cookie" }), {
      headers: { "content-type": "application/json" }
    });
  }
  if (!env.AUTH_BASE) {
    return new Response(JSON.stringify({ authed: false, reason: "missing AUTH_BASE" }), {
      headers: { "content-type": "application/json" }
    });
  }
  const r = await fetch(`${env.AUTH_BASE}/me`, { headers: { Cookie: `access_token=${token}` } });
  if (!r.ok) {
    return new Response(JSON.stringify({ authed: false, status: r.status }), {
      headers: { "content-type": "application/json" }
    });
  }
  const me = await r.json();
  return new Response(JSON.stringify({ authed: true, me }), {
    headers: { "content-type": "application/json" }
  });
};
