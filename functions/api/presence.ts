// functions/api/presence.ts
import { Env, ensureSession, proxyWithSession } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const chk = ensureSession(ctx.request);
  if (!chk.ok) return chk.response;
  // list or single user via ?user=
  const qs = new URL(ctx.request.url).searchParams.toString();
  return proxyWithSession(ctx.request, ctx.env, `/presence${qs ? `?${qs}` : ""}`, { method: "GET" });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const chk = ensureSession(ctx.request);
  if (!chk.ok) return chk.response;
  // heartbeat/status ping
  return proxyWithSession(ctx.request, ctx.env, `/presence/ping`, { method: "POST" });
};
