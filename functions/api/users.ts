// functions/api/users.ts
// List users (GET) / Create user (POST). Admin-only.
// Proxies to `${BACKEND_ORIGIN}/users` while forwarding cookies and headers.

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  return handleUsersRoot(ctx);
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  return handleUsersRoot(ctx);
};

// ---- shared ----

type Env = {
  BACKEND_ORIGIN: string; // set this in Cloudflare Pages -> Settings -> Environment variables
};

async function handleUsersRoot(
  { request, env }: { request: Request; env: Env }
): Promise<Response> {
  try {
    // Ensure admin access first
    const auth = await whoami({ request, env });
    if (!isAdmin(auth)) {
      return json({ error: "admin_required" }, 403, request);
    }

    const backend = assertOrigin(env.BACKEND_ORIGIN);
    const url = new URL(request.url);
    // Preserve query string
    const target = new URL(`/users${url.search}`, backend);

    const proxied = await fetch(target.toString(), {
      method: request.method,
      headers: forwardHeaders(request),
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.clone().text(),
      redirect: "manual",
    });

    return passthrough(proxied, request);
  } catch (e: any) {
    return json({ error: "proxy_failed", detail: String(e?.message || e) }, 502, request);
  }
}

// ---- helpers ----

function assertOrigin(v?: string): string {
  if (!v) throw new Error("BACKEND_ORIGIN is not configured");
  return v.replace(/\/+$/, "");
}

function corsHeaders(req: Request): HeadersInit {
  const h = new Headers();
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Headers", "content-type, authorization");
  h.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Origin", new URL(req.headers.get("origin") || req.url).origin);
  return h;
}

function forwardHeaders(req: Request): Headers {
  const h = new Headers();
  // Preserve auth/session context
  const hop = ["cookie", "authorization", "content-type", "accept"];
  for (const k of hop) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  // Prefer JSON
  if (!h.has("accept")) h.set("accept", "application/json");
  return h;
}

function looksLikeHtml(t: string) {
  return /<\/?[a-z][\s\S]*>/i.test(String(t || ""));
}

function json(body: any, status = 200, req?: Request): Response {
  const res = new Response(JSON.stringify(body ?? {}), {
    status,
    headers: {
      "content-type": "application/json",
      ...(req ? corsHeaders(req) : {}),
    },
  });
  return res;
}

function passthrough(upstream: Response, req: Request): Response {
  // If upstream sent HTML, surface an error to the SPA (so diagnostics can show it)
  const headers = new Headers(upstream.headers);
  for (const k of ["content-security-policy", "content-security-policy-report-only", "strict-transport-security"]) {
    headers.delete(k);
  }
  // CORS for browser calls
  const cors = corsHeaders(req);
  cors.forEach((v, k) => headers.set(k, v));
  return new Response(upstream.body, { status: upstream.status, headers });
}

async function whoami({ request, env }: { request: Request; env: Env }) {
  const backend = assertOrigin(env.BACKEND_ORIGIN);
  const r = await fetch(`${backend}/whoami`, {
    method: "GET",
    headers: forwardHeaders(request),
    redirect: "manual",
  });
  const text = await r.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = undefined; }
  if (!r.ok || !data || looksLikeHtml(text)) throw new Error("auth_check_failed");
  return data;
}

function isAdmin(auth: any): boolean {
  const me = auth?.me ?? auth ?? {};
  const role = String(me.role || "").toUpperCase();
  return role === "ADMIN" || role === "SUPERADMIN";
}
