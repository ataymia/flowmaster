// functions/api/users/[username].ts
// Get one / Update / Delete a user. Admin-only.
// Proxies to `${BACKEND_ORIGIN}/users/:username`

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => handleUser(ctx);
export const onRequestPatch: PagesFunction<Env> = async (ctx) => handleUser(ctx);
export const onRequestDelete: PagesFunction<Env> = async (ctx) => handleUser(ctx);

type Env = { BACKEND_ORIGIN: string };

async function handleUser(
  { request, env, params }: { request: Request; env: Env; params: Record<string, string> }
): Promise<Response> {
  try {
    const auth = await whoami({ request, env });
    if (!isAdmin(auth)) return json({ error: "admin_required" }, 403, request);

    const username = params?.username;
    if (!username) return json({ error: "username_required" }, 400, request);

    const backend = assertOrigin(env.BACKEND_ORIGIN);
    const url = new URL(request.url);
    const target = new URL(`/users/${encodeURIComponent(username)}${url.search}`, backend);

    const proxied = await fetch(target.toString(), {
      method: request.method,
      headers: forwardHeaders(request),
      body: request.method === "GET" ? undefined : await request.clone().text(),
      redirect: "manual",
    });

    return passthrough(proxied, request);
  } catch (e: any) {
    return json({ error: "proxy_failed", detail: String(e?.message || e) }, 502, request);
  }
}

// ---- helpers (same as in users.ts; duplicated locally for isolation) ----
function assertOrigin(v?: string): string { if (!v) throw new Error("BACKEND_ORIGIN is not configured"); return v.replace(/\/+$/, ""); }
function corsHeaders(req: Request): HeadersInit { const h=new Headers(); h.set("Access-Control-Allow-Credentials","true"); h.set("Access-Control-Allow-Headers","content-type, authorization"); h.set("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS"); h.set("Access-Control-Allow-Origin", new URL(req.headers.get("origin")||req.url).origin); return h; }
function forwardHeaders(req: Request): Headers { const h=new Headers(); for (const k of ["cookie","authorization","content-type","accept"]) { const v=req.headers.get(k); if (v) h.set(k,v); } if (!h.has("accept")) h.set("accept","application/json"); return h; }
function looksLikeHtml(t: string){ return /<\/?[a-z][\s\S]*>/i.test(String(t||"")); }
function json(body:any,status=200,req?:Request){ return new Response(JSON.stringify(body??{}),{status,headers:{"content-type":"application/json",...(req? corsHeaders(req):{})}}); }
function passthrough(upstream: Response, req: Request): Response { const headers=new Headers(upstream.headers); for (const k of ["content-security-policy","content-security-policy-report-only","strict-transport-security"]) headers.delete(k); const cors=corsHeaders(req); cors.forEach((v,k)=>headers.set(k,v)); return new Response(upstream.body,{status:upstream.status,headers}); }
async function whoami({request,env}:{request:Request;env:Env}){ const backend=assertOrigin(env.BACKEND_ORIGIN); const r=await fetch(`${backend}/whoami`,{headers:forwardHeaders(request)}); const text=await r.text(); let data:any; try{ data=text? JSON.parse(text):{}; }catch{ data=undefined; } if(!r.ok || !data || looksLikeHtml(text)) throw new Error("auth_check_failed"); return data; }
function isAdmin(auth:any){ const me=auth?.me ?? auth ?? {}; const role=String(me.role||"").toUpperCase(); return role==="ADMIN" || role==="SUPERADMIN"; }
