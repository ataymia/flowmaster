export const json = (data: any, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json', ...headers } });

export function parseCookies(req: Request){
  const map: Record<string,string> = {};
  const raw = req.headers.get('cookie') || '';
  raw.split(/;\s*/).forEach(p=>{ const i=p.indexOf('='); if(i>0){ map[p.slice(0,i)] = decodeURIComponent(p.slice(i+1)); }});
  return map;
}

export function setCookie(name: string, val: string, opts: {path?:string; maxAge?:number; httpOnly?:boolean; secure?:boolean; sameSite?:'None'|'Lax'|'Strict'} = {}){
  const path = opts.path ?? '/';
  const httpOnly = opts.httpOnly ?? true;
  const secure = opts.secure ?? true;
  const same = opts.sameSite ?? 'None';
  let c = `${name}=${val}; Path=${path}; SameSite=${same};`;
  if(httpOnly) c+=' HttpOnly;';
  if(secure) c+=' Secure;';
  if(typeof opts.maxAge==='number') c+=` Max-Age=${opts.maxAge};`;
  return c;
}

export async function proxyWithAuth(env: any, req: Request, path: string, init?: RequestInit, retryOn401 = true){
  const cookies = parseCookies(req);
  const access = cookies['access_token'];
  const refresh = cookies['refresh_token'];
  const headers = new Headers(init?.headers || {});
  if(access) headers.set('Cookie', `access_token=${access}`);
  const r = await fetch(new URL(path, env.AUTH_BASE).toString(), { method: init?.method || req.method, headers, body: init?.body, cf: {cacheTtl: 0}});
  if(r.status!==401 || !retryOn401 || !refresh) return r;

  // try refresh
  const r2 = await fetch(new URL('/auth/refresh', env.AUTH_BASE), { method:'POST', headers: { 'Cookie': `refresh_token=${refresh}` }});
  if(r2.status===204){
    const set = r2.headers.get('set-cookie'); // Worker set new access cookie
    const outHeaders = new Headers();
    if(set){
      // Extract token value if present, or simply mirror cookie name=value
      outHeaders.append('Set-Cookie', set.replace(/Domain=.*?;/i,'').replace(/Path=\/auth/,'Path=/')); // normalize path for our domain
    }
    // retry original
    const h2 = new Headers(init?.headers || {});
    const cookies2 = parseCookies(new Request('',{headers: outHeaders})); // not real, but we only pass through browser's cookie next request
    const r3 = await fetch(new URL(path, env.AUTH_BASE).toString(), { method: init?.method || req.method, headers: h2, body: init?.body });
    // Return with mirrored cookie if we got one
    const resp = new Response(r3.body, { status:r3.status, headers:r3.headers });
    if(set) resp.headers.append('Set-Cookie', set.replace(/Domain=.*?;/i,'').replace(/Path=\/auth/,'Path=/'));
    return resp;
  }
  return r;
}
