// GET /adherence → serve /public/adherence/index.html with 200 (no redirects)
export const onRequestGet: PagesFunction = async (ctx) => {
  const req = new Request(new URL("/adherence/index.html", ctx.request.url), ctx.request);
  const asset = await ctx.env.ASSETS.fetch(req);
  const res = new Response(asset.body, asset);
  res.headers.set("Cache-Control", "no-store");
  res.headers.append("Vary", "Cookie");
  return res;
};
