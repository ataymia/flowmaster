// functions/api/login.ts
interface Env { AUTH_BASE: string }

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const upstream = `${env.AUTH_BASE.replace(/\/$/, '')}/auth/login`;
  const res = await fetch(upstream, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: request.headers.get('origin') || '',
    },
    body: await request.text(),
  });

  // Pass body through
  const out = new Response(await res.arrayBuffer(), {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') || 'application/json',
    },
  });

  // *** CRITICAL: forward ALL Set-Cookie headers so the browser stores access_token on staragentdash.work
  const getAll = (res.headers as any).getAll?.bind(res.headers);
  const getSetCookie = (res.headers as any).getSetCookie?.bind(res.headers);
  const cookies: string[] =
    (getAll && getAll('set-cookie')) ||
    (getSetCookie && getSetCookie()) ||
    (res.headers.get('set-cookie') ? [res.headers.get('set-cookie') as string] : []);
  for (const c of cookies) out.headers.append('set-cookie', c);

  return out;
}
