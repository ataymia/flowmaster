// functions/api/logout.ts
function clearCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export const onRequestPost: PagesFunction = async ({ env }) => {
  const h = new Headers();
  h.append('Set-Cookie', clearCookie('access_token'));
  h.append('Set-Cookie', clearCookie('refresh_token'));

  // Optionally tell upstream
  if (env.AUTH_BASE) {
    fetch(`${env.AUTH_BASE}/auth/logout`, { method: 'POST' }).catch(() => {});
  }
  return new Response(null, { status: 204, headers: h });
};

export const onRequestGet: PagesFunction = onRequestPost;
