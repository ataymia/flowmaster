export async function onRequestGet({ env }: { env: any }) {
  return new Response(JSON.stringify({
    hasSecret: !!env.NOTION_SECRET,
    hasDb: !!env.NOTION_DATABASE_ID
  }), { status: 200, headers: { 'content-type': 'application/json' }});
}
