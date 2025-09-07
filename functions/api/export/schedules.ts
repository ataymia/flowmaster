function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie") || ""; const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return m ? m[1] : null;
}
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const token = readCookie(request, "allstar_at"); if (!token) return new Response("NO_SESSION", { status:401 });
  const url = new URL(request.url); const qs = url.search || "";
  const r = await fetch(`${env.AUTH_BASE}/export/schedules${qs}`, { headers: { Cookie:`access_token=${token}` }});
  return new Response(await r.arrayBuffer(), { status:r.status, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': r.headers.get('content-disposition') || 'attachment; filename="schedules.csv"' }});
};
