export const onRequestGet: PagesFunction = async ({ env }) => {
  return new Response(JSON.stringify({
    AUTH_BASE: env.AUTH_BASE || null
  }), { headers: { "content-type": "application/json" } });
};
