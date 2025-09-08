// functions/api/_notion.ts
import type { Env } from './_utils';

type Audience = 'all' | 'agents' | 'admins';

const PROP = {
  title: 'Title',          // title
  body:  'Text',           // rich_text (rename if your property differs)
  date:  'Date',           // date
  aud:   'Audience',       // select: all | agents | admins
  live:  'Published',      // checkbox: true to show
};

export async function queryBillboard(env: Env, audience: Audience) {
  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return { ok:false, status:500, items:[], error:'Notion env not set' };
  }

  const filters: any[] = [
    { property: PROP.live, checkbox: { equals: true } },
  ];
  if (audience !== 'all') {
    filters.push({
      or: [
        { property: PROP.aud, select: { equals: audience } },
        { property: PROP.aud, select: { equals: 'all' } },
      ],
    });
  }

  const body = {
    filter: { and: filters },
    sorts: [{ property: PROP.date, direction: 'descending' }],
    page_size: 25,
  };

  const res = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { ok:false, status:res.status, items:[], error: await res.text() };
  }

  const json = await res.json();
  const items = (json.results || []).map((p: any) => {
    const title = p.properties?.[PROP.title]?.title?.[0]?.plain_text ?? '';
    const body  = (p.properties?.[PROP.body]?.rich_text ?? []).map((t:any)=>t.plain_text).join('') ?? '';
    const date  = p.properties?.[PROP.date]?.date?.start ?? null;
    const aud   = p.properties?.[PROP.aud]?.select?.name ?? 'all';
    return { id: p.id, title, body, date, audience: aud };
  });

  return { ok:true, status:200, items };
}
