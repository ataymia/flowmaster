// functions/api/change-password.ts
import { Env, ensureAccess, upstream, forwardSetCookies, json } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const acc = ensureAccess(request);
  if (!acc.ok) return acc.response;

  // Forward body & incoming cookies to the auth worker
  const up = await upstream(env, "/auth/change-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // forward cookie for the worker to auth /me inside change-password
      cookie: request.headers.get("cookie") || "",
    },
    body: await request.clone().text(),
  });

  const outHeaders = new Headers({ "content-type": up.headers.get("content-type") || "application/json" });
  forwardSetCookies(up.headers, outHeaders);
  return new Response(up.body, { status: up.status, headers: outHeaders });
};
