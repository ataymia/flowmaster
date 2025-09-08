export const onRequestPost: PagesFunction<{ AUTH_BASE: string }> = async ({
  request,
  env,
}) => {
  const authUrl = new URL("/refresh", env.AUTH_BASE);
  const upstream = await fetch(authUrl.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text().catch(() => null),
    redirect: "manual",
  });
  const res = new Response(upstream.body, upstream);
  const origin = new URL(request.url).origin;
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
};
