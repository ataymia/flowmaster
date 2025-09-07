// GET /api/events?user=<optional>&from=YYYY-MM-DD&to=YYYY-MM-DD
// POST /api/events { status, ts? }
function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie") || ""; const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return m ? m[1] : null;
}
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const token = readCookie(request, "allstar_at"); if (!token) return json({ error: "NO_SESSION" }, 401);
  const url = new URL(request.url); const qs = url.search || "";
  const r = await fetch(`${env.AUTH_BASE}/events${qs}`, { headers: { Cookie: `access_token=${token}` }});
  return pass(r);
};
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const token = readCookie(request, "allstar_at"); if (!token) return json({ error: "NO_SESSION" }, 401);
  const body = await request.text();
  const r = await fetch(`${env.AUTH_BASE}/events`, { method:"POST", headers:{ "content-type":"application/json", Cookie:`access_token=${token}` }, body });
  return pass(r);
};
function json(o:any,s=200){ return new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}}); }
async function pass(r:Response){ const t=await r.text(); return new Response(t,{status:r.status,headers:{'content-type':'application/json'}}); }
