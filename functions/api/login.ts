import { AUTH_BASE, json, setCookie } from './_utils';

export async function onRequestPost({ request }: { request: Request }) {
  // pass through body to worker /auth/login
  const body = await request.text();
  const res = await fetch(`${AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body
  });

  let data: any = null;
  try { data = await res.json(); } catch {}

  // Worker (per our earlier change) returns access & refresh in body.
  const access  = data?.access || '';
  const refresh = data?.refresh || '';

  const headers = new Headers({ 'content-type': 'application/json' });
  if (access)  headers.append('Set-Cookie', setCookie('access_token',  access,  { maxAge: 60*15, path: '/' }));
  if (refresh) headers.append('Set-Cookie', setCookie('refresh_token', refresh, { maxAge: 60*60*24*7, path: '/' }));

  // Return minimal payload to the client
  const payload = data && res.ok
    ? { ok: true, username: data.username, role: data.role, mustChangePassword: !!data.mustChangePassword }
    : { ok: false };

  return new Response(JSON.stringify(payload), { status: res.status, headers });
}
