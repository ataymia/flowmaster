// functions/api/news.ts
import { Env, json, ensureAccess } from "./_utils";

type NotionPage = {
  id: string;
  properties: Record<string, any>;
};

const NOTION_VERSION = "2022-06-28";

function propKeyByType(props: Record<string, any>, type: string): string | null {
  for (const [k, v] of Object.entries(props || {})) {
    if (v?.type === type) return k;
  }
  return null;
}

function readTitle(p: any, key: string | null): string {
  if (!key) return "";
  const arr = p[key]?.title || [];
  return arr.map((t: any) => t?.plain_text || "").join("").trim();
}

function readRichText(p: any, key: string | null): string {
  if (!key) return "";
  const arr = p[key]?.rich_text || [];
  return arr.map((t: any) => t?.plain_text || "").join("").trim();
}

function readDateISO(p: any, key: string | null): string | null {
  if (!key) return null;
  const d = p[key]?.date;
  const iso = d?.start || d?.end || null;
  return iso || null;
}

function readSelectName(p: any, key: string | null): string | null {
  if (!key) return null;
  const s = p[key]?.select;
  return s?.name || null;
}

function readCheckbox(p: any, key: string | null): boolean {
  if (!key) return true; // if there is no published flag, treat as published
  return !!p[key]?.checkbox;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Require auth (keeps hub behavior consistent), but don’t change functionality otherwise
  const acc = ensureAccess(request);
  if (!acc.ok) return acc.response;

  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return json({ items: [], note: "notion_missing_env" }, 200, { "cache-control":"no-store" });
  }

  const audParam = new URL(request.url).searchParams.get("aud") || "ALL"; // AGENT | ADMIN | ALL

  // Query the DB (we'll filter client-side to be tolerant of property names)
  const q = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.NOTION_TOKEN}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      page_size: 25,
      // Sort if a date exists—tolerant approach: Notion ignores unknown sorts
      sorts: [{ property: "Date", direction: "descending" }],
    }),
  });

  if (!q.ok) {
    const text = await q.text().catch(()=> "");
    return json({ items: [], note: "notion_error", status: q.status, detail: text }, 200, { "cache-control":"no-store" });
  }

  const data = await q.json();
  const pages: NotionPage[] = Array.isArray(data?.results) ? data.results : [];

  const items = pages.map(page => {
    const props = page.properties || {};
    // Discover keys by type
    const titleKey = propKeyByType(props, "title");
    const textKey  = propKeyByType(props, "rich_text");
    const dateKey  = propKeyByType(props, "date");
    const selKey   = propKeyByType(props, "select");
    const chkKey   = propKeyByType(props, "checkbox");

    const title    = readTitle(props, titleKey);
    const body     = readRichText(props, textKey);
    const dateISO  = readDateISO(props, dateKey);
    const audience = (readSelectName(props, selKey) || "all").toLowerCase();
    const published= readCheckbox(props, chkKey);

    return { title, body, date: dateISO, audience, published };
  })
  // Keep only published
  .filter(it => it.published)
  // Audience gate: 'all' always passes; otherwise match value
  .filter(it => {
    if (!it.audience || it.audience === "all") return true;
    if (audParam === "ALL") return true;
    return it.audience.toLowerCase() === audParam.toLowerCase();
  })
  // Sort newest first by date if present
  .sort((a,b)=>{
    const ta = a.date ? Date.parse(a.date) : 0;
    const tb = b.date ? Date.parse(b.date) : 0;
    return tb - ta;
  });

  return json({ items }, 200, { "cache-control":"no-store" });
};
