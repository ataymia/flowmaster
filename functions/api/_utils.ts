// functions/api/_utils.ts
export interface Env {
  AUTH_BASE: string;             // e.g. https://allstar-auth.yourdomain.workers.dev
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
}

/* ---------------- JSON ---------------- */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

/* ---------------- Cookies ---------------- */
type SameSite = "Lax" | "Strict" | "None";

export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  opts: {
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: SameSite;
    maxAge?: number; // seconds
  } = {}
) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  headers.append("Set-Cookie", parts.join("; "));
}

export function clearCookie(headers: Headers, name: string, path = "/") {
  headers.append(
    "Set-Cookie",
    `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  );
}

export function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Cloudflare may combine multiple Set-Cookie lines into one; split & forward all. */
export function forwardSetCookies(src: Response | Headers, outHeaders: Headers) {
  const h = (src as any).headers ? (src as Response).headers : (src as Headers);
  const all = h.get("set-cookie");
  if (!all) return;
  const parts = all.split(/,(?=[^;=]+=[^;]+)/g);
  for (const p of parts) outHeaders.append("Set-Cookie", p.trim());
}

/** Extract a specific cookie VALUE from upstream Set-Cookie headers. */
export function pickCookieFromSetCookie(h: Headers, cookieName: string): string | null {
  const all = h.get("set-cookie");
  if (!all) return null;
  const parts = all.split(/,(?=[^;=]+=[^;]+)/g);
  for (const p of parts) {
    const first = p.split(";", 1)[0] || "";
    const [k, ...v] = first.split("=");
    if (k?.trim().toLowerCase() === cookieName.toLowerCase()) return v.join("=");
  }
  return null;
}

/* ---------------- Access control ---------------- */
function getSessionToken(req: Request): string | null {
  // Accept either cookie name (your app has used both at various points)
  return getCookie(req, "allstar_at") || getCookie(req, "access_token");
}

/** Ensure we have a session; return token if present. */
export function ensureAccess(req: Request) {
  const token = getSessionToken(req);
  if (token) return { ok: true as const, token };
  return { ok: false as const, response: json({ error: "unauthorized" }, 401) };
}

/* ---------------- Upstream base fetch ---------------- */
export function upstream(env: Env, path: string, init?: RequestInit) {
  const url = path.startsWith("http") ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}

/* ---------------- Proxies used by your routes ---------------- */

/**
 * proxyWithAuth: call the auth Worker path with Authorization: Bearer <token>.
 * Also forwards request body/method and returns upstream response (incl. headers).
 */
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const acc = ensureAccess(req);
  if (!acc.ok) return acc.response;

  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${acc.token}`);
  // preserve content-type if caller posted JSON/form
  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  const res = await upstream(env, path, {
    method: init.method || req.method,
    body: init.body ?? (req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined),
    headers,
    redirect: "manual",
  });

  // pass through body + headers (and any Set-Cookie)
  const outHeaders = new Headers(res.headers);
  // If CF collapsed Set-Cookie into one header, re-append correctly:
  const combined = outHeaders.get("set-cookie");
  if (combined) {
    outHeaders.delete("set-cookie");
    forwardSetCookies(res, outHeaders);
  }

  return new Response(res.body, { status: res.status, headers: outHeaders });
}

/**
 * proxyWithSession: similar to proxyWithAuth, but also sends Cookie header with access_token=
 * (useful for upstream endpoints that read Cookie instead of Authorization).
 */
export async function proxyWithSession(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const acc = ensureAccess(req);
  if (!acc.ok) return acc.response;

  const headers = new Headers(init.headers || {});
  // Set Authorization too (safe & convenient)
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${acc.token}`);

  // Build Cookie header, ensuring access_token is present
  const incomingCookie = req.headers.get("cookie") || "";
  let cookieHeader = incomingCookie;
  if (!/(^|;\s*)access_token=/.test(cookieHeader)) {
    cookieHeader = (cookieHeader ? cookieHeader + "; " : "") + `access_token=${acc.token}`;
  }
  headers.set("cookie", cookieHeader);

  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  const res = await upstream(env, path, {
    method: init.method || req.method,
    body: init.body ?? (req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined),
    headers,
    redirect: "manual",
  });

  const outHeaders = new Headers(res.headers);
  const combined = outHeaders.get("set-cookie");
  if (combined) {
    outHeaders.delete("set-cookie");
    forwardSetCookies(res, outHeaders);
  }

  return new Response(res.body, { status: res.status, headers: outHeaders });
}
