// functions/api/news.ts
// Fetch announcements from Notion "Team Billboard" without throwing.
// Expects NOTION_SECRET and NOTION_DATABASE_ID in **Pages** environment.

type Env = {
  NOTION_SECRET: string;
  NOTION_DATABASE_ID: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safePlain(arr: any[] | undefined): string {
  return Array.isArray(arr) ? arr.map((t: any) => t?.plain_text || "").join("") : "";
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { NOTION_SECRET, NOTION_DATABASE_ID } = env;
    if (!NOTION_SECRET || !NOTION_DATABASE_ID) {
      return json({ error: "Notion env not set" }, 500);
    }

    const url = new URL(request.url);
    const audParam = (url.searchParams.get("aud") || "all").toLowerCase(); // all | agent(s) | admin(s)

    // Build audience filter: allow "all" or the matching group.
    const audFilter =
      audParam.startsWith("admin")
        ? [
            { property: "Audience", select: { equals: "all" } },
            { property: "Audience", select: { equals: "admins" } },
          ]
        : audParam.startsWith("agent")
        ? [
            { property: "Audience", select: { equals: "all" } },
            { property: "Audience", select: { equals: "agents" } },
          ]
        : [{ property: "Audience", select: { equals: "all" } }];

    const nowIso = new Date().toISOString();

    const body = {
      filter: {
        and: [
          // PublishedAt <= now
          { property: "PublishedAt", date: { on_or_before: nowIso } },
          // ExpiresAt empty OR >= now
          {
            or: [
              { property: "ExpiresAt", date: { is_empty: true } },
              { property: "ExpiresAt", date: { on_or_after: nowIso } },
            ],
          },
          // Audience matches
          { or: audFilter },
        ],
      },
      // Pinned first, then newest first
      sorts: [
        { property: "Pinned", direction: "descending" },
        { property: "PublishedAt", direction: "descending" },
      ],
      page_size: 50,
    };

    const r = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${NOTION_SECRET}`,
          "notion-version": "2022-06-28",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      // Return 200 with a marker so your UI doesn't break.
      return json({
        items: [],
        note: "notion_error",
        status: r.status,
        detail: text,
      });
    }

    const data: any = await r.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    const items = results.map((p: any) => {
      const props = p?.properties || {};
      return {
        id: p?.id,
        title: props?.Title?.title?.[0]?.plain_text || "",
        body: safePlain(props?.Body?.rich_text),
        publishedAt: props?.PublishedAt?.date?.start || null,
        expiresAt: props?.ExpiresAt?.date?.start || null,
        pinned: !!props?.Pinned?.checkbox,
        audience: props?.Audience?.select?.name || "all",
        url: p?.url || null,
      };
    });

    return json({ items });
  } catch (e: any) {
    // Never 502 from an exception; respond cleanly.
    return json({ items: [], error: "server_error", detail: String(e?.message || e) });
  }
};
