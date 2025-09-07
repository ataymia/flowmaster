// functions/api/whoami.ts
interface Env { AUTH_BASE: string }

function pickAccessTokenFromCookie(h: string | null): string | null {
  const m = (h || '').match(/(?:^|;\s*)access_token=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const upstream = `${env.AUTH_BASE.replace(/\/$/, '')}/me`;
  const cookie = request.headers.get('cookie') || '';
  const token = pickAccessTokenFromCookie(cookie);

  const res = await fetch(upstream, {
    method: 'GET',
    headers: {
      cookie,
      origin: request.headers.get('origin') || '',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
  });
}
