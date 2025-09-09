// functions/api/login.ts
import { Env, json, upstream, setCookie, forwardSetCookies } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Forward credentials to the auth worker
  const body = await request.text(); // keep raw; user sends JSON
  const up = await upstream(env, "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    redirect: "manual",
  });

  const text = await up.text();
  const outHeaders = new Headers({ "content-type": "application/json" });

  // Forward any Set-Cookie the worker emitted (host-only on your Pages domain)
  forwardSetCookies(up, outHeaders);

  // Also set our own first-party cookies the hub expects
  try {
    const data = JSON.parse(text || "{}");
    if (data.access) {
      setCookie(outHeaders, "allstar_at", data.access, {
        maxAge: 60 * 15,
        path: "/",
        sameSite: "Lax",
        secure: true,
        httpOnly: true,
      });
    }
    if (data.refresh) {
      setCookie(outHeaders, "allstar_rt", data.refresh, {
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
        sameSite: "Lax",
        secure: true,
        httpOnly: true,
      });
    }
  } catch {
    // ignore parse errors; upstream will carry the failure details
  }

  return new Response(text, { status: up.status, headers: outHeaders });
};
