import { json, parseCookies, proxyWithAuth } from './_util';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const r = await proxyWithAuth(env, request, '/me', { method:'GET' });
  if(r.status===200) return new Response(r.body, { status:200, headers:{'Content-Type':'application/json'}});
  return json({authed:false, reason:'no cookie'}, 401);
};
