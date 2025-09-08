// functions/auth/refresh.ts
// Browser-callable refresh endpoint that *will* receive the refresh_token
// because its path starts with /auth. Proxies to your Auth Worker and
// forwards Set-Cookie so a new access_token lands in the browser.

export const onRequestPost: PagesFunction<{ AUTH_BASE: string }> = async ({ request, env }) => {
  if (!env.AUTH_BASE) {
    return new Response('{"error":"AUTH_BASE not configured"}', {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const upstream = await fetch(new URL("/auth/refresh", env.AUTH_BASE).toString(), {
    method: "POST",
    // forward cookies from the browser
    headers: { "cookie": request.headers.get("cookie") || "" },
    redirect: "manual",
  });

  // Return upstream *as-is* and preserve all Set-Cookie headers
  const res = new Response(upstream.body, { status: upstream.status });
  // Cloudflare-specific helper will expose multiple Set-Cookie values:
  const anyH: any = upstream.headers;
  if (typeof anyH.getSetCookie === "function") {
    for (const sc of anyH.getSetCookie() || []) res.headers.append("Set-Cookie", sc);
  } else {
    const one = upstream.headers.get("set-cookie");
    if (one) res.headers.append("Set-Cookie", one);
  }
  res.headers.set("Vary", "Cookie");
  return res;
};
