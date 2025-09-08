import { json, Env } from './_utils';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { NOTION_SECRET, NOTION_DATABASE_ID } = env;
  if (!NOTION_SECRET || !NOTION_DATABASE_ID) {
    return json({ items: [], note: 'notion_error', error: 'Notion env not set' }, 500);
  }

  const url = new URL(request.url);
  const audience = (url.searchParams.get('aud') || 'all').toLowerCase();

  // Query the database
  const q = await fetch('https://api.notion.com/v1/databases/' + NOTION_DATABASE_ID + '/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_SECRET}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 20 }),
  });

  if (!q.ok) {
    return json({ items: [], note: 'notion_error', status: q.status, detail: await q.text() }, 500);
  }

  const data = await q.json() as any;

  // Map to lightweight payload (property names must match your DB)
  const now = Date.now();
  const items = (data.results || [])
    .map((p: any) => {
      const props = p.properties || {};
      const title = props.Title?.title?.[0]?.plain_text || '';
      const body  = props.Body?.rich_text?.[0]?.plain_text || '';
      const pub   = props.PublishedAt?.date?.start ? Date.parse(props.PublishedAt.date.start) : 0;
      const exp   = props.ExpiresAt?.date?.start ? Date.parse(props.ExpiresAt.date.start) : 0;
      const pinned = !!props.Pinned?.checkbox;
      const aud    = (props.Audience?.select?.name || 'all').toLowerCase();
      return { title, body, publishedAt: pub, expiresAt: exp, pinned, audience: aud };
    })
    .filter((it: any) => (!it.publishedAt || it.publishedAt <= now) && (!it.expiresAt || it.expiresAt >= now))
    .filter((it: any) => it.audience === 'all' || it.audience === audience)
    .sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.publishedAt - a.publishedAt));

  return json({ items });
};
