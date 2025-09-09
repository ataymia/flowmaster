// functions/api/news.ts
import { Env, json, ensureSession } from "./_utils";

const NOTION_VERSION = "2022-06-28";

function keyByType(props: Record<string, any>, type: string, preferred?: string) {
  if (preferred && props[preferred]?.type === type) return preferred;
  for (const [k,v] of Object.entries(props||{})) if (v?.type === type) return k;
  return null;
}
const readTitle = (p:any,k:string|null)=> k ? (p[k]?.title||[]).map((t:any)=>t?.plain_text||"").join("").trim() : "";
const readRT    = (p:any,k:string|null)=> k ? (p[k]?.rich_text||[]).map((t:any)=>t?.plain_text||"").join("").trim() : "";
const readDate  = (p:any,k:string|null)=> k ? (p[k]?.date?.start || p[k]?.date?.end || null) : null;
const readSel   = (p:any,k:string|null)=> k ? (p[k]?.select?.name || null) : null;
const readCB    = (p:any,k:string|null)=> k ? !!p[k]?.checkbox : true;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // auth (accept allstar_at or access_token)
  const chk = ensureSession(request);
  if (!chk.ok) return chk.response;

  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return json({ items: [], note: "notion_missing_env" }, 200, { "cache-control":"no-store" });
  }

  const url = new URL(request.url);
  const audParam = (url.searchParams.get("aud") || "ALL").toUpperCase(); // ADMIN | AGENT | ALL
  const nowISO = new Date().toISOString();

  // Ask Notion for the first 50 rows, sorted newest by PublishedAt if it exists
  const q = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`,{
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.NOTION_TOKEN}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      page_size: 50,
      sorts: [{ property: "PublishedAt", direction: "descending" }],
    }),
  });
  if (!q.ok) {
    const detail = await q.text().catch(()=> "");
    return json({ items: [], note:"notion_error", status:q.status, detail }, 200, { "cache-control":"no-store" });
  }

  const data = await q.json();
  const pages: any[] = Array.isArray(data?.results) ? data.results : [];

  const items = pages.map(pg => {
    const props = pg.properties || {};
    const titleK = keyByType(props, "title",      "Title");
    const bodyK  = keyByType(props, "rich_text",  "Body");
    const pubK   = keyByType(props, "date",       "PublishedAt");
    const expK   = keyByType(props, "date",       "ExpiresAt");
    const audK   = keyByType(props, "select",     "Audience");
    const pinK   = keyByType(props, "checkbox",   "Pinned");

    const title = readTitle(props, titleK);
    const body  = readRT(props, bodyK);
    const pub   = readDate(props, pubK);
    const exp   = readDate(props, expK);
    const aud   = (readSel(props, audK) || "all").toLowerCase();
    const pinned= readCB(props, pinK);

    return { id: pg.id, title, body, publishedAt: pub, expiresAt: exp, audience: aud, pinned };
  })
  // visibility: must be "published" (has PublishedAt) and not expired
  .filter(it => !!it.publishedAt && (!it.expiresAt || it.expiresAt >= nowISO))
  // audience
  .filter(it => {
    if (audParam === "ALL") return true;
    if (!it.audience || it.audience === "all") return true;
    return it.audience.toUpperCase() === audParam;
  })
  // sort pinned first, then newest publishedAt
  .sort((a,b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (Date.parse(b.publishedAt) - Date.parse(a.publishedAt)));

  return json({ items }, 200, { "cache-control":"no-store" });
};
