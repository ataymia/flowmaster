// functions/api/_utils.ts
// Superset helper module compatible with prior versions.
// Exposes: json, parseCookies, setCookie, clearCookie,
// getSetCookieList, copySetCookies, pickCookieFromSetCookie,
// upstream, proxyWithAuth, ensureAccess, type Env.

export type Env = {
  AUTH_BASE?: string; // e.g. https://allstar-auth.ataymia.workers.dev
};

// ---- small utilities ----
export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}

export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  raw.split(/;\s*/).forEach((p) => {
    if (!p) return;
    const i = p.indexOf("=");
    if (i === -1) return;
    const k = decodeURIComponent(p.slice(0, i));
    const v = decodeURIComponent(p.slice(i + 1));
    out[k] = v;
  });
  return out;
}

export function setCookie(
  name: string,
  value: string,
  opts: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    domain?: string;
  } = {}
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path || "/"}`,
    (opts.httpOnly ?? true) ? "HttpOnly" : "",
    (opts.secure ?? true) ? "Secure" : "",
    `SameSite=${opts.sameSite || "Lax"}`,
  ].filter(Boolean);
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join("; ");
}

export function clearCookie(name: string, path = "/"): string {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Cloudflare’s Headers sometimes expose getSetCookie(); fall back to single header.
export function getSetCookieList(h: Headers): string[] {
  const anyH = h as any;
  if (typeof anyH.getSetCookie === "function") {
    try {
      const list = anyH.getSetCookie();
      if (Array.isArray(list)) return list;
    } catch {}
  }
  const one = h.get("set-cookie");
  return one ? [one] : [];
}

export function copySetCookies(from: Headers, to: Headers) {
  for (const v of getSetCookieList(from)) to.append("Set-Cookie", v);
}

/** Extract a specific cookie value from Set-Cookie headers */
export function pickCookieFromSetCookie(h: Headers, name: string): string | null {
  const list = getSetCookieList(h);
  for (const line of list) {
    const m = line.match(new RegExp(`^${name}=([^;]+)`));
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

// ---- upstream + proxy helpers ----
/** Low-level server-to-server call to your Auth Worker. */
export async function upstream(
  req: Request,
  env: Env,
  path: string,
  init?: RequestInit
): Promise<Response> {
  if (!env.AUTH_BASE) return json({ error: "AUTH_BASE not configured" }, 500);
  const url = new URL(path.startsWith("/") ? path : `/${path}`, env.AUTH_BASE);

  const headers = new Headers(init?.headers || {});
  // forward the incoming Cookie header for continuity
  const cookie = req.headers.get("cookie");
  if (cookie && !headers.has("cookie")) headers.set("cookie", cookie);

  // pass through JSON content-type when appropriate
  const reqCT = req.headers.get("content-type") || "";
  if (!headers.has("content-type") && reqCT.includes("application/json")) {
    headers.set("content-type", "application/json");
  }

  return fetch(url.toString(), {
    method: init?.method || "GET",
    headers,
    body: init?.body,
    redirect: "manual",
    credentials: "include",
  });
}

/**
 * Transparent proxy: forward the request to the Auth Worker and
 * return the response while preserving Set-Cookie and important headers.
 */
export async function proxyWithAuth(
  ctx: { request: Request; env: Env },
  path: string,
  init?: RequestInit,
  extraHeaderPredicate?: (lowerName: string) => boolean
): Promise<Response> {
  const r = await upstream(ctx.request, ctx.env, path, init);

  // Start with same status/body; we’ll selectively copy headers
  const out = new Response(r.body, { status: r.status });

  // Always split caches on auth state
  out.headers.set("Vary", "Cookie");

  // Copy key headers (content-type, cache-control, etag) and any extras the caller wants
  r.headers.forEach((v, k) => {
    const lower = k.toLowerCase();
    if (
      lower === "content-type" ||
      lower === "cache-control" ||
      lower === "etag" ||
      lower === "last-modified" ||
      (extraHeaderPredicate && extraHeaderPredicate(lower))
    ) {
      out.headers.set(k, v);
    }
  });

  // Preserve all Set-Cookie headers so cookies set by the worker reach the browser
  copySetCookies(r.headers, out.headers);

  return out;
}

/**
 * Ensure an access token is present; if not, try /auth/refresh.
 * Returns { ok, refreshResponse? } so caller can copy Set-Cookie if needed.
 */
export async function ensureAccess(ctx: { request: Request; env: Env }): Promise<{
  ok: boolean;
  refreshResponse?: Response;
}> {
  const c = parseCookies(ctx.request);
  if (c["access_token"]) return { ok: true };

  const r = await upstream(ctx.request, ctx.env, "/auth/refresh", { method: "POST" });
  if (r.status === 204) return { ok: true, refreshResponse: r };
  return { ok: false, refreshResponse: r };
}
