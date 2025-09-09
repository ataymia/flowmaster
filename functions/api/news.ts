import { Env, json, ensureAccess } from "./_utils";

const NOTION_VERSION = "2022-06-28";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const acc = ensureAccess(request);
  if (!acc.ok) return acc.response;

  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return json({ items: [], note: "notion_missing_env" }, 200, { "cache-control":"no-store" });
  }

  const aud = (new URL(request.url).searchParams.get("aud") || "ALL").toUpperCase();

  const q = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.NOTION_TOKEN}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({ page_size: 25, sorts: [{ property: "Date", direction: "descending" }] }),
  });

  if (!q.ok) return json({ items: [], note:"notion_error", status:q.status, detail: await q.text() }, 200);

  const data = await q.json();
  const items = (data.results || []).map((page: any) => {
    const props = page.properties || {};
    const key = (t: string) => Object.entries(props).find(([,v]: any) => v?.type === t)?.[0];

    const titleKey = key("title");
    const textKey  = key("rich_text");
    const dateKey  = key("date");
    const selKey   = key("select");
    const chkKey   = key("checkbox");

    const title = (props[titleKey!]?.title || []).map((t:any)=>t.plain_text).join("") || "";
    const body  = (props[textKey! ]?.rich_text || []).map((t:any)=>t.plain_text).join("") || "";
    const date  = props[dateKey! ]?.date?.start || null;
    const audn  = (props[selKey!  ]?.select?.name || "all").toLowerCase();
    const live  = !!props[chkKey! ]?.checkbox;

    return { title, body, date, audience: audn, published: live };
  })
  .filter((it:any)=> it.published)
  .filter((it:any)=> aud === "ALL" || it.audience === "all" || it.audience.toUpperCase() === aud)
  .sort((a:any,b:any)=> (b.date?Date.parse(b.date):0) - (a.date?Date.parse(a.date):0));

  return json({ items }, 200, { "cache-control":"no-store" });
};
