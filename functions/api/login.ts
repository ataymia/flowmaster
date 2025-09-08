export const onRequestOptions: PagesFunction = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Headers", "content-type");
  h.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  return new Response(null, { status: 204, headers: h });
};

export const onRequestPost: PagesFunction<{ AUTH_BASE: string }> = async ({
  request,
  env,
}) => {
  const authUrl = new URL("/login", env.AUTH_BASE);
  const upstream = await fetch(authUrl.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
    redirect: "manual",
  });

  // Forward upstream as-is so Set-Cookie survives
  const res = new Response(upstream.body, upstream);
  const origin = new URL(request.url).origin;
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
};
