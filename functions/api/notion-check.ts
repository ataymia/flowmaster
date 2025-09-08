import { Env, json } from "./_utils";
export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({
    ok: true,
    has_secret: Boolean(env.NOTION_SECRET),
    has_db: Boolean(env.NOTION_DATABASE_ID),
  });
