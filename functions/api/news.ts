import { json, Env } from './_utils';

function normalizeDbId(id: string) {
  const raw = id.replace(/-/g, '');
  if (raw.length !== 32) return id;
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.NOTION_SECRET || !env.NOTION_DB_BILLBOARD) {
    return json({ error: 'Notion env not set' }, 500);
  }

  const dbId = normalizeDbId(env.NOTION_DB_BILLBOARD);
  const audQ = (new URL(request.url).searchParams.get('aud') || 'all').toLowerCase();

  // 🔧 includes "PublishedAt" now
  const props = {
    title:    [env.NOTION_PROP_TITLE,     'Title'     ].filter(Boolean) as string[],
    body:     [env.NOTION_PROP_BODY,      'Body','Text'].filter(Boolean) as string[],
    publish:  [env.NOTION_PROP_PUBLISH,   'PublishedAt','PublishAt','Date'].filter(Boolean) as string[],
    expires:  [env.NOTION_PROP_EXPIRES,   'ExpiresAt','Date 1'].filter(Boolean) as string[],
    pinned:   [env.NOTION_PROP_PINNED,    'Pinned','Checkbox'].filter(Boolean) as string[],
    audience: [env.NOTION_PROP_AUDIENCE,  'Audience','Select','Select 1','Select 2'].filter(Boolean) as string[],
  };

  const db = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
    headers: {
      Authorization: `Bearer ${env.NOTION_SECRET}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!db.ok) {
    const t = await db.text().catch(() => '');
    return json({ error: 'notion_db_fetch_failed', detail: t }, db.status);
  }

  const schema = await db.json();
  const have = new Set(Object.keys(schema.properties || {}));
  const pick = (c: string[]) => c.find(n => have.has(n));

  const P = {
    title:   pick(props.title)!,
    body:    pick(props.body),
    publish: pick(props.publish),
    expires: pick(props.expires),
    pinned:  pick(props.pinned),
    audience:pick(props.audience),
  };

  const nowIso = new Date().toISOString();
  const and: any[] = [];
  if (P.publish) and.push({ property: P.publish, date: { on_or_before: nowIso } });
  if (P.expires) and.push({ property: P.expires, date: { on_or_after: nowIso } });
  if (P.audience) {
    and.push({
      or: [
        { property: P.audience, select: { equals: 'all' } },
        { property: P.audience, select: { equals: audQ } },
      ],
    });
  }

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_SECRET}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      page_size: 20,
      filter: and.length ? { and } : undefined,
      sorts: P.publish ? [{ property: P.publish, direction: 'descending' }] : undefined,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return json({ error: 'notion_query_failed', detail: t }, res.status);
  }

  const out = await res.json();
  const items = (out.results || []).map((r: any) => {
    const titleText = (r.properties?.[P.title]?.title || []).map((x: any) => x.plain_text).join('').trim();
    const bodyText  = P.body ? (r.properties?.[P.body]?.rich_text || []).map((x: any) => x.plain_text).join('').trim() : '';
    const publishAt = P.publish ? (r.properties?.[P.publish]?.date?.start || null) : null;
    const expiresAt = P.expires ? (r.properties?.[P.expires]?.date?.start || null) : null;
    const pinned    = P.pinned ? !!r.properties?.[P.pinned]?.checkbox : false;
    const audience  = (P.audience ? r.properties?.[P.audience]?.select?.name : 'all') || 'all';

    return { id: r.id, title: titleText, body: bodyText, publishAt, expiresAt, pinned, audience: audience.toLowerCase() };
  });

  items.sort((a: any, b: any) => Number(b.pinned) - Number(a.pinned));
  return json({ items });
};
