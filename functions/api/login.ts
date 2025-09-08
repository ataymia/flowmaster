// functions/api/login.ts
// Proxies login to AUTH_BASE and forwards Set-Cookie so cookies land on Pages domain.
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!env.AUTH_BASE) {
    return new Response(JSON.stringify({ error: "AUTH_BASE not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const upstream = await fetch(`${env.AUTH_BASE}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
    credentials: "include",
    redirect: "manual",
  });

  // Proxy body & status
  const out = new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
  });

  // Copy ALL Set-Cookie headers to staragentdash.work
  const getSetCookie = (upstream.headers as any).getSetCookie?.();
  if (Array.isArray(getSetCookie)) {
    for (const v of getSetCookie) out.headers.append("Set-Cookie", v);
  } else {
    const sc = upstream.headers.get("set-cookie");
    if (sc) out.headers.append("Set-Cookie", sc);
  }

  // Make it explicit for credentialed XHR
  out.headers.set("Vary", "Cookie");
  return out;
};

// Optional: block other verbs
export const onRequestGet: PagesFunction = async () =>
  new Response("Method Not Allowed", { status: 405 });
