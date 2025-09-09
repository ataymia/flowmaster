// functions/api/_utils.ts

export interface Env {
  AUTH_BASE: string;            // e.g., https://allstar-auth.your-worker.workers.dev
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
function parseCookieHeader(h: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getCookie(req: Request, name: string): string | null {
  const map = parseCookieHeader(req.headers.get("cookie"));
  return map[name] ?? null;
}

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
  const parts: string[] = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
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

/**
 * Forward every Set-Cookie from an upstream response/headers into dst headers.
 * Accepts either a Response or a Headers as the first argument.
 */
export function forwardSetCookies(src: Response | Headers, dst: Headers) {
  const get = (h: Headers) => h.get("set-cookie");
  const headers: Headers = (src as Response).headers ? (src as Response).headers : (src as Headers);

  // Cloudflare often flattens multiple Set-Cookie into a single header string.
  const flattened = get(headers);
  if (flattened) {
    // split on comma that starts a new cookie: ,<token>=
    const parts = flattened.split(/,(?=[^;=]+?=)/g);
    for (const p of parts) dst.append("Set-Cookie", p.trim());
    return;
  }

  // Fallback: iterate (some runtimes keep multiple)
  try {
    (headers as any).forEach?.((val: string, key: string) => {
      if (key && key.toLowerCase() === "set-cookie" && val) {
        dst.append("Set-Cookie", val);
      }
    });
  } catch {
    /* noop */
  }
}

/**
 * Find a single cookie value by name inside Set-Cookie(s).
 * Accepts Headers, a single combined string, or an array of strings.
 */
export function pickCookieFromSetCookie(
  src: Headers | string | string[] | null | undefined,
  name: string
): string | null {
  let lines: string[] = [];

  if (!src) return null;

  if (src instanceof Headers) {
    const flattened = src.get("set-cookie");
    if (flattened) lines = flattened.split(/,(?=[^;=]+?=)/g);
  } else if (Array.isArray(src)) {
    lines = src.slice();
  } else if (typeof src === "string") {
    lines = src.split(/,(?=[^;=]+?=)/g);
  }

  for (const line of lines) {
    const first = line.split(";", 1)[0] || "";
    const eq = first.indexOf("=");
    if (eq === -1) continue;
    const k = first.slice(0, eq).trim();
    const v = first.slice(eq + 1).trim();
    if (k === name) return v || null;
  }
  return null;
}

/* ---------------- Session / Auth helpers ----------------
   Accept either cookie:
   - access_token  (worker’s normal cookie)
   - allstar_at    (Pages session cookie we set after login)
---------------------------------------------------------*/
export function ensureSession(req: Request) {
  const access = getCookie(req, "access_token");
  const pageAT = getCookie(req, "allstar_at");
  if (access || pageAT) return { ok: true as const };
  return {
    ok: false as const,
    response: json({ error: "unauthorized" }, 401, { "cache-control": "no-store" }),
  };
}
/** Back-compat alias used by older files */
export function ensureAccess(req: Request) {
  return ensureSession(req);
}

/* ---------------- Upstream helpers ---------------- */
export function upstream(env: Env, path: string, init?: RequestInit) {
  const url = path.startsWith("http") ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}

/**
 * Proxy adding Authorization: Bearer <access_token|allstar_at>.
 * Use for Worker endpoints that expect Bearer header.
 */
export async function proxyWithAuth(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const token = getCookie(req, "access_token") || getCookie(req, "allstar_at");
  if (!token) return json({ error: "unauthorized" }, 401);

  const headers = new Headers(init.headers || {});
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);

  // forward content-type if original had it
  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  const res = await upstream(env, path, {
    ...init,
    method: init.method || req.method,
    body: init.body ?? req.body,
    headers,
    redirect: "manual",
  });

  const outHeaders = new Headers();
  const resCT = res.headers.get("content-type");
  if (resCT) outHeaders.set("content-type", resCT);
  forwardSetCookies(res, outHeaders); // bubble any Set-Cookie
  return new Response(res.body, { status: res.status, headers: outHeaders });
}

/**
 * Proxy sending the token as a Cookie (for Worker routes like /me, /presence).
 */
export async function proxyWithSession(
  req: Request,
  env: Env,
  path: string,
  init: RequestInit = {}
) {
  const token = getCookie(req, "access_token") || getCookie(req, "allstar_at");
  if (!token) return json({ error: "unauthorized" }, 401);

  const headers = new Headers(init.headers || {});
  headers.set("cookie", `access_token=${token}`);
  const ct = req.headers.get("content-type");
  if (ct && !headers.has("content-type")) headers.set("content-type", ct);

  const res = await upstream(env, path, {
    ...init,
    method: init.method || req.method,
    body: init.body ?? req.body,
    headers,
    redirect: "manual",
  });

  const outHeaders = new Headers();
  const resCT = res.headers.get("content-type");
  if (resCT) outHeaders.set("content-type", resCT);
  forwardSetCookies(res, outHeaders);
  return new Response(res.body, { status: res.status, headers: outHeaders });
}
