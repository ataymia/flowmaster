import { json, setCookie } from './_utils';

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const body = await request.json() as any; // {email?, username?, password}
  const r = await fetch(new URL('/auth/login', env.AUTH_BASE), {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  const data = await r.json().catch(()=> ({}));
  if(!r.ok) return json({error:'INVALID_LOGIN'}, 401);

  // Worker returns { access, refresh, username, role, ... }
  const h = new Headers();
  if(data.access)  h.append('Set-Cookie', setCookie('access_token',  data.access,  { maxAge: 60*15 }));
  if(data.refresh) h.append('Set-Cookie', setCookie('refresh_token', data.refresh, { maxAge: 60*60*24*7 }));
  return json({ ok:true, username:data.username, role:data.role, mustChangePassword:data.mustChangePassword }, 200, Object.fromEntries(h));
};
