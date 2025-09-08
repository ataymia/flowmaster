// functions/api/notion-check.ts
type Env = { NOTION_SECRET: string; NOTION_DATABASE_ID: string };
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const ok = !!env.NOTION_SECRET && !!env.NOTION_DATABASE_ID;
  return new Response(
    JSON.stringify({
      ok,
      db_id: env.NOTION_DATABASE_ID || null,
      secret_set: !!env.NOTION_SECRET,
    }),
    { headers: { "content-type": "application/json" } }
  );
};
