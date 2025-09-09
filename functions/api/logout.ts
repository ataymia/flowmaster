// Clears session cookies on Pages and best-effort logs out at the Worker.
function clear(name:string){ return `${name}=; Path=/; Max-Age=0; Secure; SameSite=Lax; HttpOnly`; }
function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie") || ""; const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return m ? m[1] : null;
}
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const access = readCookie(request, "allstar_at");
  const h = new Headers({ 'content-type':'application/json' });
  h.append('Set-Cookie', clear('allstar_at'));
  h.append('Set-Cookie', clear('allstar_rt'));
  if (access && env.AUTH_BASE) {
    // best effort – Worker will drop its own cookies on its domain
    try { await fetch(`${env.AUTH_BASE}/auth/logout`, { method:'POST', headers:{ Cookie:`access_token=${access}` } }); } catch {}
  }
  return new Response(JSON.stringify({ ok:true }), { headers:h });
};
