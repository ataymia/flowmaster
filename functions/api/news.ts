import { Env, json, ensureAccess } from "./_utils";
const NOTION_VERSION = "2022-06-28";

type Page = { properties: Record<string, any> };

const byType = (props: Record<string, any>, type: string) =>
  Object.entries(props||{}).find(([,v]) => v?.type === type)?.[0] || null;

const getTitle = (p:any,k:string|null)=> k? (p[k]?.title||[]).map((t:any)=>t?.plain_text||"").join("").trim() : "";
const getRT    = (p:any,k:string|null)=> k? (p[k]?.rich_text||[]).map((t:any)=>t?.plain_text||"").join("").trim() : "";
const getDate  = (p:any,k:string|null)=> {
  if(!k) return null; const d=p[k]?.date; return d?.start || d?.end || null;
};
const getSel   = (p:any,k:string|null)=> k? (p[k]?.select?.name||null) : null;
const getChk   = (p:any,k:string|null)=> k? !!p[k]?.checkbox : false;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const acc = ensureAccess(request); if (!acc.ok) return acc.response;

  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return json({ items: [], note: "notion_missing_env" }, 200, { "cache-control":"no-store" });
  }

  const audParam = (new URL(request.url).searchParams.get("aud") || "ALL").toUpperCase();

  // Pull pages (sort hints are best-effort; Notion ignores unknown props gracefully)
  const q = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method:"POST",
    headers:{
      "authorization": `Bearer ${env.NOTION_TOKEN}`,
      "notion-version": NOTION_VERSION,
      "content-type":"application/json",
    },
    body: JSON.stringify({
      page_size: 25,
      sorts: [{ property:"PublishedAt", direction:"descending" }]
    }),
  });

  if (!q.ok) {
    const text = await q.text().catch(()=> "");
    return json({ items: [], note: "notion_error", status: q.status, detail: text }, 200, { "cache-control":"no-store" });
  }

  const data = await q.json();
  const pages: Page[] = Array.isArray(data?.results) ? data.results : [];

  const nowISO = new Date().toISOString();

  const items = pages.map(pg => {
    const props = pg.properties || {};

    // discover keys by type, but prefer common names when present
    const titleKey = props["Title"]?.type==="title" ? "Title" : byType(props,"title");
    const bodyKey  = props["Body"]?.type==="rich_text" ? "Body" : byType(props,"rich_text");

    const pubKey   = props["PublishedAt"]?.type==="date" ? "PublishedAt" : (props["Date"]?.type==="date" ? "Date" : byType(props,"date"));
    const expKey   = props["ExpiresAt"]?.type==="date" ? "ExpiresAt" : null;

    const audKey   = props["Audience"]?.type==="select" ? "Audience" : byType(props,"select");
    const pinKey   = props["Pinned"]?.type==="checkbox" ? "Pinned" : byType(props,"checkbox"); // optional

    const title    = getTitle(props, titleKey);
    const body     = getRT(props, bodyKey);
    const publishedAt = getDate(props, pubKey);
    const expiresAt   = getDate(props, expKey);
    const audience    = (getSel(props, audKey) || "all").toLowerCase();
    const pinned      = getChk(props, pinKey);

    // show rule: pinned OR (publishedAt <= now AND (no expiry or expires >= now))
    const show = pinned || ((publishedAt ? publishedAt <= nowISO : true) && (expiresAt ? expiresAt >= nowISO : true));
    return { title, body, date: publishedAt, audience, pinned, show };
  })
  .filter(it => it.show)
  .filter(it => {
    if (audParam === "ALL") return true;
    if (!it.audience || it.audience === "all") return true;
    return it.audience === audParam.toLowerCase();
  })
  .sort((a,b)=> (Number(b.pinned)-Number(a.pinned)) || Date.parse(b.date||0) - Date.parse(a.date||0));

  return json({ items }, 200, { "cache-control":"no-store" });
};
