// functions/api/_utils.ts

export interface Env {
  AUTH_BASE: string;            // e.g. https://allstar-auth.ataymia.workers.dev
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
}

/* ---------- JSON helper ---------- */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

/* ---------- Cookie helpers ---------- */

type SameSite = "Lax" | "Strict" | "None";

function buildCookie(
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
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  if (opts.secure ?? true) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  opts?: {
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: SameSite;
    maxAge?: number;
  }
) {
  headers.append("Set-Cookie", buildCookie(name, value, opts));
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

/* Parse all Set-Cookie header lines from a Response/Headers */
function getSetCookieLines(src: Response | Headers): string[] {
  // CF’s Response headers sometimes expose getSetCookie(); use it if present
  const any = src as any;
  if (typeof any?.headers?.getSetCookie === "function") {
    const arr = any.headers.getSetCookie() || [];
    if (arr.length) return arr;
  }
  // Generic: iterate headers and collect all set-cookie lines
  const h = (src instanceof Response) ? src.headers : src;
  const lines: string[] = [];
  try {
    (h as any).forEach?.((v: string, k: string) => {
      if (k?.toLowerCase() === "set-cookie" && v) lines.push(v);
    });
  } catch {}
  if (!lines.length) {
    const single = h.get("set-cookie");
    if (single) {
      // If multiple cookies were flattened into one header, split on comma before a k=v
      const parts = single.split(/,(?=[^;]+?=)/g);
      return parts.map(s => s.trim());
    }
  }
  return lines;
}

/**
 * Forward every Set-Cookie from upstream `src` to outgoing `dst` (no rewriting).
 */
export function forwardSetCookies(src: Response | Headers, dst: Headers) {
  for (const line of getSetCookieLines(src)) {
    dst.append("Set-Cookie", line);
  }
}

/**
 * Extract the **cookie value** (not the whole line) for a cookie name
 * from the upstream Set-Cookie headers.
 */
export function pickCookieFromSetCookie(src: Response | Headers, name: string): string | null {
  for (const line of getSetCookieLines(src)) {
    const [pair] = line.split(";", 1);
    if (!pair) continue;
    const [k, ...rest] = pair.split("=");
    if (k?.trim().toLowerCase() === name.toLowerCase()) {
      return (rest.join("=") || "").trim(); // raw value only
    }
  }
  return null;
}

/* ---------- Upstream helper ---------- */
export function upstream(env: Env, path: string, init?: RequestInit) {
  const url = path.startsWith("http") ? path : `${env.AUTH_BASE}${path}`;
  return fetch(url, init);
}
