import { proxyWithAuth } from './_util';

export const onRequest: PagesFunction = async ({ request, env }) => {
  if(request.method==='GET'){
    const url = new URL(request.url);
    const q = '/schedules?'+url.searchParams.toString();
    const r = await proxyWithAuth(env, request, q, { method:'GET' });
    return new Response(r.body, { status:r.status, headers:r.headers });
  }
  if(request.method==='POST'){
    const body = await request.text();
    const r = await proxyWithAuth(env, request, '/schedules', {
      method:'POST', headers:{'Content-Type':'application/json'}, body
    });
    return new Response(r.body, { status:r.status, headers:r.headers });
  }
  return new Response(null,{status:405});
};
