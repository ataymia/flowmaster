import type { Env } from './_utils';
import { json } from './_utils';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const ok = !!env.NOTION_SECRET && !!env.NOTION_DATABASE_ID;
  let db_status = 0, db_ok = false, db_text = '', search_status = 0, search_ok = false, search_text = '';

  if (ok) {
    try {
      const r = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}`, {
        headers: {
          'Authorization': `Bearer ${env.NOTION_SECRET}`,
          'Notion-Version': '2022-06-28'
        }
      });
      db_status = r.status; db_ok = r.ok; db_text = await r.text();
    } catch (e: any) { db_text = String(e); }

    try {
      const r2 = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.NOTION_SECRET}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'Team Billboard' })
      });
      search_status = r2.status; search_ok = r2.ok; search_text = await r2.text();
    } catch (e: any) { search_text = String(e); }
  }

  return json({ ok, db_status, db_ok, db_text, search_status, search_ok, search_text });
};
