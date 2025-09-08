// functions/api/_utils.ts
export type Env = {
  AUTH_BASE: string; // e.g. https://allstar-auth.ataymia.workers.dev
  NOTION_SECRET?: string;
  NOTION_DATABASE_ID?: string;
};

export function json(data: any, status = 200, headers?: HeadersInit) {
  const h = new Headers(headers);
  if (!h.has("content-type")) h.set("content-type", "application/json");
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function parseCookies(req: Request) {
  const out: Record<string, string> = {};
  const raw = req.headers.get("cookie") || "";
  raw.split(/;\s*/).forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > 0) out[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
  });
  return out;
}

export function setCookie(
  name: string,
  val: string,
  {
    maxAge,
    path = "/",
    httpOnly = true,
    sameSite = "Lax",
    secure = true,
  }: { maxAge?: number; path?: string; httpOnly?: boolean; sameSite?: "Lax" | "Strict" | "None"; secure?: boolean } = {}
) {
  let v = `${name}=${encodeURIComponent(val)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) v += "; HttpOnly";
  if (secure) v += "; Secure";
  if (typeof maxAge === "number") v += `; Max-Age=${maxAge}`;
  return v;
}

export function pickCookieFromSetCookie(all: string[] | null, name: string) {
  if (!all) return null;
  for (const line of all) {
    if (line.startsWith(`${name}=`)) return line;
  }
  return null;
}

export async function upstream(env: Env, path: string, init?: RequestInit) {
  const url = `${env.AUTH_BASE.replace(/\/+$/, "")}${path}`;
  return fetch(url, init);
}

// Light proxy helper that forwards body/headers/cookies to the auth Worker
export async function proxyWithAuth(req: Request, env: Env, targetPath: string) {
  const cookie = req.headers.get("cookie") || "";
  const init: RequestInit = {
    method: req.method,
    headers: new Headers(req.headers),
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.clone().arrayBuffer(),
  };
  (init.headers as Headers).set("cookie", cookie);
  return upstream(env, targetPath, init);
}
