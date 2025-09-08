// Pass-through middleware — do NOT redirect anything here.
export const onRequest: PagesFunction = async (ctx) => {
  return ctx.next();
};
