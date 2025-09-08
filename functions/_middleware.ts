// functions/_middleware.ts (safe pass-through)
export const onRequest = async (ctx: any) => {
  const url = new URL(ctx.request.url);
  // Never touch API
  if (url.pathname.startsWith('/api/')) return ctx.next();
  // No edge redirects for HTML; pages handle it client-side
  return ctx.next();
};
