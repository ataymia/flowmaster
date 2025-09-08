// functions/api/login.ts
// Proxy login to the Auth Worker and forward Set-Cookie so cookies land on the Pages domain.

function allow(h: Headers) {
  h.set("Access-Control-Allow-Origin", "*"); // pages origin fetches this directly; adjust if you lock it down
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type");
  h.set("Access-Control-Max-Age", "600");
}

export const onRequestOptions: PagesFunction = async () => {
  const h = new Headers();
  allow(h);
  return new Response(null, { status: 204, headers: h });
};

async function handlePost(request: Request, env: any): Promise<Response> {
  if (!env.AUTH_BASE) {
    return new Response(JSON.stringify({ error: "AUTH_BASE not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // ⚠️ Your Auth Worker expects /auth/login (not /login)
  const upstream = await fetch(`${env.AUTH_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
    credentials: "include",
    redirect: "manual",
  });

  const out = new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "Vary": "Cookie",
    },
  });

  // Forward ALL set-cookie headers so cookies are set on staragentdash.work
  const anyHeaders = upstream.headers as any;
  const setCookies: string[] =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie") as string] : []);

  for (const v of setCookies) out.headers.append("Set-Cookie", v);

  // CORS allow for fetch usage
  allow(out.headers);

  return out;
}

export const onRequestPost: PagesFunction = async ({ request, env }) =>
  handlePost(request, env);

// Fallback (so “Cannot POST” can’t occur if the function is picked up)
export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method.toUpperCase() === "POST") {
    // Should never hit if onRequestPost is wired, but just in case
    return new Response(JSON.stringify({ error: "Unexpected route fallthrough" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response("Use POST /api/login", { status: 405 });
};
