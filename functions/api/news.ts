// functions/api/news.ts
import { Env, json, ensureSession } from "./_utils";

const NOTION_VERSION = "2022-06-28";

// Select properties flexibly (schema-safe): prefer specific keys but fall back by type
function keyByType(props: Record<string, any>, type: string, preferred?: string) {
  if (preferred && props[preferred]?.type === type) return preferred;
  for (const [k, v] of Object.entries(props || {})) if ((v as any)?.type === type) return k;
  return null;
}
const readTitle = (p:any,k:string|null)=> k ? (p[k]?.title||[]).map((t:any)=>t?.plain_text||"").join("").trim() : "";
const readRT    = (p:any,k:string|null)=> k ? (p[k]?.rich_text||[]).map((t:any)=>t?.plain_text||"").join("").trim() : "";
const readDate  = (p:any,k:string|null)=> k ? (p[k]?.date?.start || p[k]?.date?.end || null) : null;
const readSel   = (p:any,k:string|null)=> k ? (p[k]?.select?.name || null) : null;
const readCB    = (p:any,k:string|null)=> k ? !!p[k]?.checkbox : true;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Must be logged in (same as working build)
  const session = ensureSession(request);
  if (!session.ok) return session.response;

  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return json({ items: [], error: "missing_notion_config" }, 200, { "cache-control":"no-store" });
  }

  const url = new URL(request.url);
  const audParam = (url.searchParams.get("audience") || "ALL").toUpperCase();
  const nowISO = new Date().toISOString();

  // Query Notion database; sorting here keeps recent news first
  const r = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      page_size: 50,
      sorts: [{ property: "PublishedAt", direction: "descending" }],
    }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(()=> "");
    return json({ items: [], error: "notion_error", status: r.status, body: txt }, 200, { "cache-control":"no-store" });
  }

  const data = await r.json().catch(()=> ({} as any));
  const sampleProps = (data?.results?.[0]?.properties) || {};

  const kTitle = keyByType(sampleProps, "title", "Title");
  const kBody  = keyByType(sampleProps, "rich_text", "Body");
  const kPub   = keyByType(sampleProps, "date", "PublishedAt");
  const kExp   = keyByType(sampleProps, "date", "ExpiresAt");
  const kAud   = keyByType(sampleProps, "select", "Audience");
  const kPin   = keyByType(sampleProps, "checkbox", "Pinned");

  const items = (data?.results || [])
    .map((page:any) => {
      const p = page.properties || {};
      return {
        id: page.id,
        title:       readTitle(p, kTitle),
        body:        readRT(p, kBody),
        publishedAt: readDate(p, kPub),
        expiresAt:   readDate(p, kExp),
        audience:   (readSel(p, kAud) || "all").toLowerCase(),
        pinned:      readCB(p, kPin),
        url: page?.url || null,
      };
    })
    // must be published and not expired
    .filter(it => !!it.publishedAt && (!it.expiresAt || it.expiresAt >= nowISO))
    // audience filter
    .filter(it => {
      if (audParam === "ALL") return true;
      if (!it.audience || it.audience === "all") return true;
      return it.audience.toUpperCase() === audParam;
    })
    // sort pinned first, then newest
    .sort((a,b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (Date.parse(b.publishedAt) - Date.parse(a.publishedAt)));

  return json({ items }, 200, { "cache-control":"no-store" });
};
