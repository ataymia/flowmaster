export const onRequestGet: PagesFunction = async ({ env }) =>
  new Response(JSON.stringify({ AUTH_BASE: env.AUTH_BASE || null }), { headers:{'content-type':'application/json'} });
