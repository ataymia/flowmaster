// functions/api/whoami.ts
// Robust "who am I" that supports legacy allstar_at OR access_token,
// refreshes if needed, and returns user fields at TOP LEVEL so the hub works.

import { Env, json } from "./_utils";

function readCookieVal(header: string, name: string): string | null {
  const m = (header || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

// Forward *all* Set-Cookie lines from an upstream Response to the outgoing headers
function forwardSetCookiesFromResponse(up: Response, out: Headers) {
  const h: any = up.headers;
  let setCookies: string[] = [];

  if (typeof h.getSetCookie === "function") {
    setCookies = h.getSetCookie() || [];
  }
  if (!setCookies.length) {
    const single = up.headers.get("set-cookie");
    if (single) setCookies = [single];
  }
  if (!setCookies.length) return;

  // Cloudflare may flatten multiple cookies; split safely on a cookie boundary
  const lines: string[] = [];
  for (const raw of setCookies) {
    lines.push(...raw.split(/,(?=[^;=]+=[^;]+)/g).map(s => s.trim()).filter(Boolean));
  }
  for (const line of lines) out.append("set-cookie", line);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const cookieHdr = request.headers.get("cookie") || "";
  const legacy = readCookieVal(cookieHdr, "allstar_at");
  const access = readCookieVal(cookieHdr, "access_token") || legacy;
  const refresh = readCookieVal(cookieHdr, "refresh_token");

  if (!access && !refresh) {
    // Not signed in
    return json({ authed: false, error: "no_cookie" }, 401, { "cache-control": "no-store" });
  }

  // Helper to call /me with a given access token
  const getMe = async (acc: string) =>
    fetch(`${env.AUTH_BASE}/me`, { headers: { cookie: `access_token=${acc}` }, redirect: "manual" });

  // 1) Try with whatever access token we have
  if (access) {
    const r = await getMe(access);
    if (r.ok) {
      const me = await r.json();
      // Return user fields at the TOP LEVEL for hub compatibility
      return new Response(JSON.stringify({ authed: true, ...me, _raw: me }), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }
  }

  // 2) If unauthorized and we have refresh, refresh once and retry
  if (refresh) {
    const rf = await fetch(`${env.AUTH_BASE}/auth/refresh`, {
      method: "POST",
      headers: { cookie: `refresh_token=${refresh}` },
      redirect: "manual",
    });

    const outH = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
    forwardSetCookiesFromResponse(rf, outH);

    // Try /me again if we appear to have a new access cookie
    const refreshedAccess =
      readCookieVal(outH.get("set-cookie") || "", "access_token") ||
      readCookieVal(rf.headers.get("set-cookie") || "", "access_token");

    if (refreshedAccess) {
      const r2 = await getMe(refreshedAccess);
      forwardSetCookiesFromResponse(r2, outH); // just in case /me also sets something
      if (r2.ok) {
        const me = await r2.json();
        return new Response(JSON.stringify({ authed: true, ...me, _raw: me }), {
          status: 200,
          headers: outH,
        });
      }
    }

    // Refresh failed
    return new Response(JSON.stringify({ authed: false, error: "refresh_failed" }), {
      status: 401,
      headers: outH,
    });
  }

  // Fallthrough unauthorized
  return json({ authed: false, error: "unauthorized" }, 401, { "cache-control": "no-store" });
};
