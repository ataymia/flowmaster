export const onRequestGet: PagesFunction = async (ctx) => {
  const { env } = ctx;

  const query = {
    sorts: [{ property: 'PublishAt', direction: 'descending' }],
    filter: {
      or: [
        { property: 'ExpiresAt', date: { is_empty: true } },
        { property: 'ExpiresAt', date: { on_or_after: new Date().toISOString() } }
      ]
    }
  };

  const r = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(query)
  });

  if (!r.ok) return new Response(await r.text(), { status: r.status });

  const data = await r.json();

  const items = (data.results || []).map((p: any) => ({
    id: p.id,
    title: p.properties?.Title?.title?.[0]?.plain_text ?? 'Untitled',
    body: p.properties?.Body?.rich_text?.map((t:any)=>t.plain_text).join('') ?? '',
    pinned: p.properties?.Pinned?.checkbox ?? false,
    publishAt: p.properties?.PublishAt?.date?.start ?? null,
    audience: p.properties?.Audience?.select?.name ?? 'all'
  }));

  return new Response(JSON.stringify(items), {
    headers: { 'content-type': 'application/json', 'Cache-Control': 's-maxage=60' }
  });
};

