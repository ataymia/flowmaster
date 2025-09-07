// Returns Team Billboard items from Notion.
// - Respects audience: agents see 'all/agents'; admins see everything.
// - Publishes items only if PublishedAt <= now and (ExpiresAt empty or >= now).
// - Sort: pinned first, then newest PublishedAt.

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const nowIso = new Date().toISOString();

  const audience = await getAudience(env, request); // 'admin' | 'agent'
  const db = env.NOTION_DB_ID;
  const token = env.NOTION_TOKEN;

  if (!db || !token) {
    return json({ error: 'NOTION_MISCONFIG' }, 500);
  }

  // Filters cover both "PublishedAt" and "PublishAt" (you used both spellings)
  const filter: any = {
    and: [
      {
        or: [
          { property: 'PublishedAt', date: { on_or_before: nowIso } },
          { property: 'PublishAt',  date: { on_or_before: nowIso } },
          { property: 'PublishedAt', date: { is_empty: true } },
          { property: 'PublishAt',  date: { is_empty: true } }
        ]
      },
      {
        or: [
          { property: 'ExpiresAt', date: { on_or_after: nowIso } },
          { property: 'ExpiresAt', date: { is_empty: true } }
        ]
      }
    ]
  };

  // Agents shouldn't see admin-only posts.
  if (audience !== 'admin') {
    filter.and.push({
      or: [
        { property: 'Audience', select: { equals: 'all' } },
        { property: 'Audience', select: { equals: 'agents' } },
        { property: 'Audience', select: { is_empty: true } }
      ]
    });
  }

  const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ page_size: 50, filter })
  });

  if (!r.ok) {
    const body = await r.text();
    return json({ error: 'NOTION_QUERY_FAILED', status: r.status, body }, 500);
  }

  const data = await r.json();

  const items = (data.results || []).map((p: any) => {
    const props = p.properties || {};
    const titleProp = props.Title || props.Name;
    const title = titleProp?.title?.map((t: any) => t.plain_text).join('') || 'Untitled';
    const body = (props.Body?.rich_text || []).map((t: any) => t.plain_text).join('');
    const publishedAt = props.PublishedAt?.date?.start || props.PublishAt?.date?.start || null;
    const expiresAt = props.ExpiresAt?.date?.start || null;
    const pinned = !!props.Pinned?.checkbox;
    const aud = (props.Audience?.select?.name || 'all').toLowerCase();
    return { id: p.id, title, body, publishedAt, expiresAt, pinned, audience: aud };
  });

  // pinned first, then newest
  items.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1) || (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  return json({ items, audience });
};

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

async function getAudience(env: any, request: Request): Promise<'admin' | 'agent'> {
  try {
    const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)allstar_at=([^;]+)/);
    if (!m) return 'agent';
    const r = await fetch(`${env.AUTH_BASE}/me`, { headers: { Cookie: `access_token=${m[1]}` } });
    if (!r.ok) return 'agent';
    const me = await r.json();
    return (me.role === 'ADMIN' || me.role === 'SUPERADMIN') ? 'admin' : 'agent';
  } catch {
    return 'agent';
  }
}
