// functions/api/news.ts
import { json, Env } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { NOTION_SECRET, NOTION_DB_ID } = env;
  if (!NOTION_SECRET || !NOTION_DB_ID) {
    return json({ items: [], note: "notion_env_missing" }, 200);
  }

  const aud = new URL(request.url).searchParams.get("aud") || "all";

  // Query database (filter by Audience and date windows)
  const q = await fetch("https://api.notion.com/v1/databases/" + NOTION_DB_ID + "/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_SECRET}`,
      "Notion-Version": "2022-06-28",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: "Audience",
            select: { equals: aud },
          },
          {
            property: "PublishedAt",
            date: { on_or_before: new Date().toISOString() },
          },
          {
            or: [
              { property: "ExpiresAt", date: { is_empty: true } },
              { property: "ExpiresAt", date: { on_or_after: new Date().toISOString() } },
            ],
          },
        ],
      },
      sorts: [{ property: "Pinned", direction: "descending" }, { property: "PublishedAt", direction: "descending" }],
    }),
  });

  const data = await q.json();
  if (!q.ok) return json({ items: [], note: "notion_error", detail: JSON.stringify(data), status: q.status }, q.status);

  const items =
    (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.properties?.Title?.title?.[0]?.plain_text || "",
      body: r.properties?.Body?.rich_text?.[0]?.plain_text || "",
      publishedAt: r.properties?.PublishedAt?.date?.start || null,
      expiresAt: r.properties?.ExpiresAt?.date?.start || null,
      pinned: !!r.properties?.Pinned?.checkbox,
      audience: r.properties?.Audience?.select?.name || "all",
    })) || [];

  return json({ items });
};
