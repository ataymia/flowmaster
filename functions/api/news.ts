// /api/news?aud=AGENT|ADMIN|ALL
import type { Env } from './_utils';
import { json } from './_utils';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const audParam = (url.searchParams.get('aud') || 'ALL').toUpperCase(); // AGENT | ADMIN | ALL

  if (!env.NOTION_SECRET || !env.NOTION_DATABASE_ID) {
    return json({ error: 'Notion env not set' }, 500);
  }

  const nowISO = new Date().toISOString();
  const body = {
    filter: {
      and: [
        {
          or: [
            { property: 'Pinned', checkbox: { equals: true } },
            {
              and: [
                { property: 'PublishedAt', date: { on_or_before: nowISO } },
                { property: 'ExpiresAt',   date: { on_or_after:  nowISO } }
              ]
            }
          ]
        },
        ...(audParam === 'ALL'
          ? []
          : [{
              property: 'Audience',
              select: { equals: audParam === 'ADMIN' ? 'admins' : 'agents' }
            }])
      ]
    },
    sorts: [
      { property: 'Pinned',      direction: 'descending' },
      { property: 'PublishedAt', direction: 'descending' }
    ],
    page_size: 20
  };

  const r = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_SECRET}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    return json({ items: [], note: 'notion_error', status: r.status, detail: await r.text() }, 502);
  }

  const data = await r.json<any>();
  const items = (data.results || []).map((row: any) => {
    const props = row.properties || {};
    const title =
      (props['Title']?.title?.[0]?.plain_text) ||
      (props['Title']?.title?.map((t: any) => t?.plain_text).join(' ') || '');
    const bodyText =
      (props['Body']?.rich_text?.map((t: any) => t?.plain_text).join(' ') || '');
    const published = props['PublishedAt']?.date?.start || null;
    const expires   = props['ExpiresAt']?.date?.start   || null;
    const pinned    = !!props['Pinned']?.checkbox;
    const audience  = props['Audience']?.select?.name || 'all';
    return { title, body: bodyText, published, expires, pinned, audience };
  });

  return json({ items });
};
