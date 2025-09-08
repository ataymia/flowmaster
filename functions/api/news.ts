import { Env, json, ensureAccess } from "./_utils";

function propText(p: any) {
  return Array.isArray(p?.rich_text) ? p.rich_text.map((r: any) => r.plain_text).join("") : "";
}
function propTitle(p: any) {
  return Array.isArray(p?.title) ? p.title.map((r: any) => r.plain_text).join("") : "";
}
function propDate(p: any, key: string) {
  const v = p?.[key]?.date?.start || null;
  return v ? new Date(v) : null;
}
function propSelect(p: any, key: string) {
  return p?.[key]?.select?.name || null;
}
function propCheckbox(p: any, key: string) {
  return Boolean(p?.[key]?.checkbox);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const guard = await ensureAccess(request);
  if (guard) return guard;

  if (!env.NOTION_SECRET || !env.NOTION_DATABASE_ID) {
    return json({ items: [], note: "notion_error", status: 500, detail: "NOTION env missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const aud = (url.searchParams.get("aud") || "all").toLowerCase();

  const q = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NOTION_SECRET}`,
      "Notion-Version": "2022-06-28",
      "content-type": "application/json",
    },
    body: JSON.stringify({ page_size: 50, sorts: [{ timestamp: "last_edited_time", direction: "descending" }] }),
  });

  if (!q.ok) {
    const detail = await q.text();
    return json({ items: [], note: "notion_error", status: q.status, detail }, { status: 500 });
  }

  const data = await q.json();
  const now = Date.now();

  const items = (data.results || [])
    .filter((r: any) => r.object === "page" && r.properties)
    .map((r: any) => {
      const p = r.properties;
      return {
        id: r.id,
        title: propTitle(p?.Title || p?.Title__ || p?.title || p?.Name),
        body: propText(p?.Body || p?.Text),
        publishAt: propDate(p, "PublishedAt") || propDate(p, "Date") || null,
        expiresAt: propDate(p, "ExpiresAt") || propDate(p, "Date 1") || null,
        pinned: propCheckbox(p, "Pinned"),
        audience: (propSelect(p, "Audience") || propSelect(p, "Select") || "all").toLowerCase(),
        url: r.url,
      };
    })
    .filter((x: any) => x.title)
    .filter((x: any) => x.audience === "all" || x.audience === aud)
    .filter((x: any) => {
      const start = x.publishAt ? x.publishAt.getTime() : 0;
      const end = x.expiresAt ? x.expiresAt.getTime() : (now + 1);
      return now >= start && now <= end;
    })
    .sort((a: any, b: any) => Number(b.pinned) - Number(a.pinned));

  return json({ items });
};
