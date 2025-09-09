// functions/api/news.ts
import { Env, json, ensureAccess } from "./_utils";
import { queryBillboard } from "./_notion";

type Audience = "all" | "agents" | "admins";

// --------- helpers for the tolerant fallback ----------
const NOTION_VERSION = "2022-06-28";

function firstKeyByType(
  props: Record<string, any>,
  type: string,
  preferNames: RegExp[] = []
): string | null {
  const entries = Object.entries(props || {});
  // prefer explicit name matches first
  for (const [k, v] of entries) {
    if (v?.type === type && preferNames.some(rx => rx.test(k))) return k;
  }
  // else first of that type
  for (const [k, v] of entries) {
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
  return d?.start || d?.end || null;
}
function readSelectName(p: any, key: string | null): string | null {
  if (!key) return null;
  const s = p[key]?.select;
  return s?.name || null;
}
const nowISO = () => new Date().toISOString();

// --------- main handler ----------
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // keep hub behavior: require a valid session
  const acc = ensureAccess(request);
  if (!acc.ok) return acc.response;

  const url = new URL(request.url);
  const rawAud = (url.searchParams.get("aud") || "ALL").toUpperCase();
  const aud: Audience =
    rawAud === "ADMIN" || rawAud === "ADMINS"
      ? "admins"
      : rawAud === "AGENT" || rawAud === "AGENTS"
      ? "agents"
      : "all";

  // --- Primary: strict schema-aware query (matches your DB exactly) ---
  const primary = await queryBillboard(env, aud);
  if (primary.ok) {
    return json({ items: primary.items }, 200, { "cache-control": "no-store" });
  }

  // --- Fallback: tolerant reader (auto-detect properties by type/name) ---
  if (!env.NOTION_SECRET || !env.NOTION_DATABASE_ID) {
    return json({ items: [], note: "notion_missing_env" }, 200, { "cache-control": "no-store" });
  }

  const res = await fetch(
    `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_SECRET}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 25 }), // no filters; we filter locally
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json(
      { items: [], note: "notion_error", status: res.status, detail },
      200,
      { "cache-control": "no-store" }
    );
  }

  const data = await res.json();
  const pages: any[] = Array.isArray(data?.results) ? data.results : [];

  const items = pages
    .map((page) => {
      const props = page.properties || {};

      // Prefer your names; fall back gracefully
      const titleKey = firstKeyByType(props, "title", [/^title$/i]);
      const bodyKey  = firstKeyByType(props, "rich_text", [/^body$/i, /^text$/i]);
      const pubKey   = firstKeyByType(props, "date", [/^publishedat?$/i, /^publish(ed)?$/i]);
      const expKey   = firstKeyByType(props, "date", [/^expires?at?$/i]);
      const pinKey   = firstKeyByType(props, "checkbox", [/^pinned?$/i]);
      const audKey   = firstKeyByType(props, "select", [/^audience$/i]);

      const title   = readTitle(props, titleKey);
      const body    = readRichText(props, bodyKey);
      const pubISO  = readDateISO(props, pubKey);
      const expISO  = readDateISO(props, expKey);
      const pinned  = pinKey ? !!props[pinKey]?.checkbox : false;
      const rowAud  = (readSelectName(props, audKey) || "all").toLowerCase();

      return { title, body, date: pubISO, expires: expISO, audience: rowAud, pinned };
    })
    // publish window: PublishedAt <= now AND (no ExpiresAt OR ExpiresAt > now)
    .filter((it) => {
      const now = nowISO();
      const pubOK = !it.date || it.date <= now; // if no date, allow
      const notExpired = !it.expires || it.expires > now;
      return pubOK && notExpired;
    })
    // audience gate
    .filter((it) => {
      if (!it.audience || it.audience === "all") return true;
      if (aud === "all") return true;
      return it.audience === aud;
    })
    // sort: pinned first, then newest PublishedAt
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ta = a.date ? Date.parse(a.date) : 0;
      const tb = b.date ? Date.parse(b.date) : 0;
      return tb - ta;
    });

  return json({ items }, 200, { "cache-control": "no-store" });
};
