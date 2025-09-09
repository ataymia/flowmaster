// functions/api/whoami.ts
import { Env, json, forwardSetCookies } from "./_utils";

function readCookieVal(header: string, name: string): string | null {
  const m = (header || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

function buildCookieHeader(srcCookieHeader: string): string | null {
  // Support legacy 'allstar_at' or modern 'access_token' + 'refresh_token'
  const access = readCookieVal(srcCookieHeader, "access_token") ||
                 readCookieVal(srcCookieHeader, "allstar_at");
  const refresh = readCookieVal(srcCookieHeader, "refresh_token");
  const parts: string[] = [];
  if (access) parts.push(`access_token=${access}`);
  if (refresh) parts.push(`refresh_token=${refresh}`);
  return parts.length ? parts.join("; ") : null;
}

// Try to extract a cookie value from an upstream Response
function getCookieFromUpstream(res: Response, name: string): string | null {
  const anyH = res.headers as any;
  let all: string[] = [];
  if (typeof anyH.getSetCookie === "function") {
    all = anyH.getSetCookie() || [];
  }
  if (!all.length) {
    const single = res.headers.get("set-cookie");
    if (single) all = [single];
  }
  if (!all.length) return null;
  const re = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`);
  for (const line of all) {
    const m = line.match(new RegExp(`${name}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const clientCookie = request.headers.get("cookie") || "";

  // Build the cookie header we’ll send to the auth worker
  let upstreamCookie = buildCookieHeader(clientCookie);
  if (!upstreamCookie) {
    return json({ authed: false, error: "no_cookie" }, 401, { "cache-control": "no-store" });
  }

  // 1) Call /me
  let res = await fetch(`${env.AUTH_BASE}/me`, {
    headers: { cookie: upstreamCookie },
    redirect: "manual",
  });

  // 2) If unauthorized but we have refresh_token, attempt refresh and retry once
  if (res.status === 401 && /refresh_token=/.test(upstreamCookie)) {
    const refreshOnly = readCookieVal(upstreamCookie, "refresh_token");
    if (refreshOnly) {
      const rf = await fetch(`${env.AUTH_BASE}/auth/refresh`, {
        method: "POST",
        headers: { cookie: `refresh_token=${refreshOnly}` },
        redirect: "manual",
      });

      // Forward any Set-Cookie (new access_token, etc.) back to browser
      const outH = new Headers();
      forwardSetCookies(rf, outH);

      // If we received a new access_token, use it for a second /me call
      const newAccess = getCookieFromUpstream(rf, "access_token");
      if (newAccess) {
        upstreamCookie = `access_token=${newAccess}; refresh_token=${refreshOnly}`;
        res = await fetch(`${env.AUTH_BASE}/me`, {
          headers: { cookie: upstreamCookie },
          redirect: "manual",
        });
      }

      // Merge Set-Cookie from /me (if any) into headers we’ll return
      const outH2 = new Headers(outH);
      forwardSetCookies(res, outH2);

      if (!res.ok) {
        return new Response(await res.text(), {
          status: 401,
          headers: outH2,
        });
      }

      const me = await res.json();
      // Return user fields at the top level for hub compatibility
      return new Response(JSON.stringify({ authed: true, ...me, _raw: me }), {
        status: 200,
        headers: outH2,
      });
    }
  }

  // Normal success path
  if (res.ok) {
    const outH = new Headers();
    forwardSetCookies(res, outH); // in case /me also sets/extends cookies
    const me = await res.json();
    return new Response(JSON.stringify({ authed: true, ...me, _raw: me }), {
      status: 200,
      headers: outH,
    });
  }

  // Still unauthorized (or other error)
  return json({ authed: false, status: res.status }, 401, { "cache-control": "no-store" });
};
