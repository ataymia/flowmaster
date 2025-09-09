// functions/api/presence.ts
import { Env, json, ensureAccess, upstream } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const acc = ensureAccess(request);
  if (!acc.ok) return acc.response;

  // Prefer Authorization: Bearer to avoid cookie domain issues
  const r = await upstream(env, "/presence" + new URL(request.url).search, {
    headers: { authorization: `Bearer ${acc.token}` },
  });
  const out = new Response(r.body, { status: r.status, headers: new Headers(r.headers) });
  return out;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const acc = ensureAccess(request);
  if (!acc.ok) return acc.response;

  const body = await request.text();
  const r = await upstream(env, "/presence/ping", {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") || "application/json",
      authorization: `Bearer ${acc.token}`,
    },
    body,
  });
  const out = new Response(r.body, { status: r.status, headers: new Headers(r.headers) });
  return out;
};
