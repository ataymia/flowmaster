function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie") || ""; const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return m ? m[1] : null;
}
export const onRequest: PagesFunction = async ({ request, env }) => {
  const token = readCookie(request, "allstar_at"); if (!token) return json({ error: "NO_SESSION" }, 401);
  const url = new URL(request.url); const id = url.searchParams.get("id");
  const init: RequestInit = { headers: { Cookie: `access_token=${token}` } };

  if (request.method === "GET") {
    const r = await fetch(`${env.AUTH_BASE}/users`, init); return pass(r);
  }
  if (request.method === "POST") {
    init.method = "POST"; init.headers = { ...init.headers, "content-type":"application/json" }; init.body = await request.text();
    const r = await fetch(`${env.AUTH_BASE}/users`, init); return pass(r);
  }
  if (!id) return json({ error:"MISSING_ID" }, 400);

  if (request.method === "PATCH") {
    init.method = "PATCH"; init.headers = { ...init.headers, "content-type":"application/json" }; init.body = await request.text();
    const r = await fetch(`${env.AUTH_BASE}/users/${encodeURIComponent(id)}`, init); return pass(r);
  }
  if (request.method === "DELETE") {
    init.method = "DELETE";
    const r = await fetch(`${env.AUTH_BASE}/users/${encodeURIComponent(id)}`, init); return pass(r);
  }
  return json({ ok:true });
};
function json(o:any,s=200){ return new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}}); }
async function pass(r:Response){ const t=await r.text(); return new Response(t,{status:r.status,headers:{'content-type':'application/json'}}); }
