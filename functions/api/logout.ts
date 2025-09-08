// functions/api/logout.ts
// Clears cookies on the Pages domain and (optionally) tells upstream to revoke.

function clear(name: string) {
  // Expire immediately, wide path.
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export const onRequestPost: PagesFunction = async ({ env }) => {
  const h = new Headers();
  h.append("Set-Cookie", clear("access_token"));
  h.append("Set-Cookie", clear("refresh_token"));

  // Optionally notify upstream (don't care if it fails)
  if (env.AUTH_BASE) {
    fetch(`${env.AUTH_BASE}/logout`, { method: "POST" }).catch(() => {});
  }

  return new Response(null, { status: 204, headers: h });
};

export const onRequestGet: PagesFunction = onRequestPost;
