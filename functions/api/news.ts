// functions/api/news.ts
interface Env {
  NOTION_SECRET: string;
  NOTION_DATABASE_ID: string;
}

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function nowISO() { return new Date().toISOString(); }

// Build a Notion query with safe fallbacks even if a property is missing.
function buildFilter(aud?: string) {
  const now = nowISO();

  const audienceOr = aud
    ? {
        or: [
          { property: 'Audience', select: { equals: 'ALL' } },
          { property: 'Audience', select: { equals: aud.toUpperCase() } },
        ],
      }
    : undefined;

  const publishedOr = {
    or: [
      { property: 'PublishedAt', date: { is_empty: true } },
      { property: 'PublishedAt', date: { on_or_before: now } },
    ],
  };

  const expiresOr = {
    or: [
      { property: 'ExpiresAt', date: { is_empty: true } },
      { property: 'ExpiresAt', date: { on_or_after: now } },
    ],
  };

  const and: any[] = [publishedOr, expiresOr];
  if (audienceOr) and.push(audienceOr);
  return { and };
}

function textFromRich(r: any[]): string {
  return (Array.isArray(r) ? r : [])
    .map((t: any) => t?.plain_text || '')
    .join('')
    .trim();
}

function getProp(page: any, key: string) {
  return page?.properties?.[key];
}

function mapPage(page: any) {
  const pTitle = getProp(page, 'Title');
  const pBody = getProp(page, 'Body');
  const pPinned = getProp(page, 'Pinned');
  const pAudience = getProp(page, 'Audience');
  const pPub = getProp(page, 'PublishedAt');
  const pExp = getProp(page, 'ExpiresAt');

  const title =
    textFromRich(pTitle?.title || []) ||
    page?.properties?.Name?.title?.[0]?.plain_text ||
    '(untitled)';

  const body = textFromRich(pBody?.rich_text || []);
  const pinned = !!pPinned?.checkbox;
  const audience = pAudience?.select?.name || 'ALL';
  const publishedAt = pPub?.date?.start || null;
  const expiresAt = pExp?.date?.start || null;

  return {
    id: page.id,
    title,
    body,
    pinned,
    audience,
    publishedAt,
    expiresAt,
    url: page?.url,
  };
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  try {
    if (!env.NOTION_SECRET || !env.NOTION_DATABASE_ID) {
      return new Response(JSON.stringify({ error: 'Notion env not set' }), { status: 500 });
    }

    const url = new URL(request.url);
    const audParam = (url.searchParams.get('aud') || 'AGENT').toUpperCase();

    const qBody = {
      filter: buildFilter(audParam),
      sorts: [
        { property: 'Pinned', direction: 'descending' as const },
        { property: 'PublishedAt', direction: 'descending' as const },
      ],
      page_size: 50,
    };

    const res = await fetch(`${NOTION_API}/databases/${env.NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.NOTION_SECRET}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(qBody),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: 'Notion error', detail: t }), { status: 502 });
    }

    const data = await res.json();
    const items = (data.results || []).map(mapPage);

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, s-maxage=60',
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server error', detail: String(e?.message || e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
