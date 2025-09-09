// functions/api/news.ts
import { Env, json, ensureAccess } from "./_utils";

type NotionPage = { id: string; properties: Record<string, any> };
const NOTION_VERSION = "2022-06-28";

function propKeyByType(props: Record<string, any>, type: string): string | null {
  for (const [k, v] of Object.entries(props || {})) if (v?.type === type) return k;
  return null;
}
const readTitle     = (p: any, k: string | null) => k ? (p[k]?.title || []).map((t:any)=>t?.plain_text||"").join("").trim() : "";
const readRichText  = (p: any, k: string | null) => k ? (p[k]?.rich_text || []).map((t:any)=>t?.plain_text||"").join("").trim() : "";
const readDateISO   = (p: any, k: string | null) => k ? (p[k]?.date?.start || p[k]?.date?.end || null) : null;
const readSelect    = (p: any, k: string | null) => k ? (p[k]?.select?.name || null) : null;
const readCheckbox  = (p: any, k: string | null) => (k ? !!p[k]?.checkbox : true);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const acc = ensureAccess(request);
  if (!acc.ok) return acc.response;

  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return json({ items: [], note: "notion_missing_env" }, 200, { "cache-control": "no-store" });
  }

  const audParam = (new URL(request.url).searchParams.get("aud") || "ALL").toUpperCase();

  const q = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.NOTION_TOKEN}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      page_size: 25,
      sorts: [{ property: "Date", direction: "descending" }], // ignored if not present
    }),
  });

  if (!q.ok) {
    const text = await q.text().catch(() => "");
    return json({ items: [], note: "notion_error", status: q.status, detail: text }, 200, { "cache-control": "no-store" });
  }

  const data = await q.json();
  const pages: NotionPage[] = Array.isArray(data?.results) ? data.results : [];

  const items = pages.map(pg => {
    const props = pg.properties || {};
    const titleKey = propKeyByType(props, "title");
    const textKey  = propKeyByType(props, "rich_text");
    const dateKey  = propKeyByType(props, "date");
    const selKey   = propKeyByType(props, "select");
    const chkKey   = propKeyByType(props, "checkbox");

    return {
      title:     readTitle(props, titleKey),
      body:      readRichText(props, textKey),
      date:      readDateISO(props, dateKey),
      audience: (readSelect(props, selKey) || "all").toLowerCase(),
      published: readCheckbox(props, chkKey),
    };
  })
  .filter(it => it.published)
  .filter(it => (audParam === "ALL") || (it.audience === "all") || (it.audience === audParam.toLowerCase()))
  .sort((a,b)=> (Date.parse(b.date||"0") - Date.parse(a.date||"0")));

  return json({ items }, 200, { "cache-control": "no-store" });
};
