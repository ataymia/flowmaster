// No redirects here; just let static assets and API handlers run.
// Adds Vary: Cookie to split caches by auth state.

export const onRequest: PagesFunction = async (ctx) => {
  const res = await ctx.next();
  res.headers.append('Vary', 'Cookie');
  return res;
};
