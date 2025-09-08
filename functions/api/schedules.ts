import { Env, proxyWithAuth } from "./_utils";
export const onRequest: PagesFunction<Env> = async (ctx) =>
  proxyWithAuth(ctx.request, ctx.env, "/schedules");
