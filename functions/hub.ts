// Serve /public/hub.html with 200. No redirects.
export const onRequestGet: PagesFunction = async (ctx) => {
  const url = new URL("/hub.html", ctx.request.url);
  const res = await ctx.env.ASSETS.fetch(new Request(url, ctx.request));
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "no-store");
  out.headers.append("Vary", "Cookie");
  return out;
};
