// functions/api/news.ts
interface Env {
  NOTION_SECRET: string;
  NOTION_DATABASE_ID: string;
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

const nowISO = () => new Date().toISOString();

function textFromRich(r: any[]): string {
  return (Array.isArray(r) ? r : [])
    .map((t: any) => t?.plain_text || "")
    .join("")
    .trim();
}

function mapPage(page: any) {
  const props = page?.properties || {};

  const title =
    textFromRich(props?.Title?.title || []) ||
    textFromRich(props?.Name?.title || []) ||
    "(untitled)";

  const body = textFromRich(props?.Body?.rich_text || []);
  const pinned = !!props?.Pinned?.checkbox;
  const audience = props?.Audience?.select?.name || "ALL";
  const publishedAt = props?.PublishedAt?.date?.start || null;
  const expiresAt = props?.ExpiresAt?.date?.start || null;

  return {
    id: page?.id,
    title,
    body,
    pinned,
    audience,
    publishedAt,
    expiresAt,
    url: page?.url,
  };
}

function buildFilter(aud: string | null) {
  const now = nowISO();
  const audienceOr = aud
    ? {
        or: [
          { property: "Audience", select: { equals: "ALL" } },
          { property: "Audience", select: { equals: aud.toUpperCase() } },
        ],
      }
    : undefined;

  const publishedOr = {
    or: [
      { property: "PublishedAt", date: { is_empty: true } },
      { property: "PublishedAt", date: { on_or_before: now } },
    ],
  };

  const expiresOr = {
    or: [
      { property: "ExpiresAt", date: { is_empty: true } },
      { property: "ExpiresAt", date: { on_or_after: now } },
    ],
  };

  const and: any[] = [publishedOr, expiresOr];
  if (audienceOr) and.push(audienceOr);
  return { and };
}

export async function onRequestGet(ctx: {
  request: Request;
  env: Env;
}) {
  const { request, env } = ctx;

  try {
    // If env missing, do NOT crash the Hub — return empty list.
    if (!env.NOTION_SECRET || !env.NOTION_DATABASE_ID) {
      return json({ items: [], note: "env_missing" }, 200);
    }

    const url = new URL(request.url);
    const aud = (url.searchParams.get("aud") || "AGENT").toUpperCase();

    // Timeout guard so we never bubble a 502
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort("timeout"), 8000);

    const queryBody = {
      filter: buildFilter(aud),
      sorts: [
        { property: "Pinned", direction: "descending" as const },
        { property: "PublishedAt", direction: "descending" as const },
      ],
      page_size: 50,
    };

    let upstreamRes: Response | null = null;
    try {
      upstreamRes = await fetch(
        `${NOTION_API}/databases/${env.NOTION_DATABASE_ID}/query`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${env.NOTION_SECRET}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(queryBody),
        }
      );
    } catch (e: any) {
      clearTimeout(to);
      // Network/timeout error — return empty feed with detail
      return json(
        { items: [], note: "fetch_failed", detail: String(e?.message || e) },
        200
      );
    }
    clearTimeout(to);

    const ct = upstreamRes.headers.get("content-type") || "";
    if (!upstreamRes.ok) {
      // Notion replied with error; return safe JSON with detail text
      const detail = ct.includes("json")
        ? await upstreamRes.text()
        : await upstreamRes.text();
      return json(
        { items: [], note: "notion_error", status: upstreamRes.status, detail },
        200
      );
    }

    // Parse and map defensively
    let data: any = null;
    try {
      data = ct.includes("json") ? await upstreamRes.json() : await upstreamRes.text();
    } catch (e: any) {
      return json(
        { items: [], note: "parse_error", detail: String(e?.message || e) },
        200
      );
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    const items = results.map(mapPage);

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        // small cache so the hub loads fast but updates quickly
        "cache-control": "public, s-maxage=60",
      },
    });
  } catch (e: any) {
    // Final catch-all: never throw a 502
    return json(
      { items: [], note: "handler_error", detail: String(e?.message || e) },
      200
    );
  }
}
