// functions/api/_notion.ts
import type { Env } from "./_utils";

export type Audience = "all" | "agents" | "admins";

const PROP = {
  title: "Title",          // title
  body:  "Body",           // rich_text
  publish: "PublishedAt",  // date
  expire: "ExpiresAt",     // date
  pinned: "Pinned",        // checkbox
  audience: "Audience",    // select: all | agents | admins
};

function nowISODate() {
  // Notion date filters expect YYYY-MM-DD or full ISO; full ISO is fine.
  return new Date().toISOString();
}

export async function queryBillboard(env: Env, audience: Audience) {
  // Your env names (as you noted): NOTION_SECRET + NOTION_DATABASE_ID
  if (!env.NOTION_SECRET || !env.NOTION_DATABASE_ID) {
    return { ok: false, status: 500, items: [], error: "Notion env not set" };
  }

  // publish window: PublishedAt <= now AND (ExpiresAt is empty OR ExpiresAt > now)
  const publishNow = nowISODate();

  const andFilters: any[] = [
    { property: PROP.publish, date: { on_or_before: publishNow } },
    {
      or: [
        { property: PROP.expire, date: { is_empty: true } },
        { property: PROP.expire, date: { after: publishNow } },
      ],
    },
  ];

  // audience targeting (admins see rows for "admins" or "all"; agents see "agents" or "all")
  if (audience !== "all") {
    andFilters.push({
      or: [
        { property: PROP.audience, select: { equals: audience } },
        { property: PROP.audience, select: { equals: "all" } },
      ],
    });
  }

  const body = {
    filter: { and: andFilters },
    sorts: [
      { property: PROP.pinned, direction: "descending" },
      { property: PROP.publish, direction: "descending" },
    ],
    page_size: 25,
  };

  const res = await fetch(
    `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_SECRET}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    return { ok: false, status: res.status, items: [], error: await res.text() };
  }

  const json = await res.json();

  const items = (json.results || []).map((p: any) => {
    const title =
      p.properties?.[PROP.title]?.title?.[0]?.plain_text?.toString() ?? "";
    const body =
      (p.properties?.[PROP.body]?.rich_text ?? [])
        .map((t: any) => t?.plain_text?.toString() ?? "")
        .join("") ?? "";
    const date = p.properties?.[PROP.publish]?.date?.start ?? null;
    const audienceVal =
      p.properties?.[PROP.audience]?.select?.name?.toString() ?? "all";
    const pinned = !!p.properties?.[PROP.pinned]?.checkbox;

    return {
      id: p.id,
      title,
      body,
      date,
      audience: audienceVal,
      pinned,
    };
  });

  return { ok: true, status: 200, items };
}
