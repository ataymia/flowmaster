export async function onRequestGet({ env }: { env: any }) {
  const out: any = { ok: true };
  try {
    const headers = {
      Authorization: `Bearer ${env.NOTION_SECRET}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };
    // check direct read
    const r1 = await fetch(
      `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}`,
      { headers }
    );
    out.db_status = r1.status;
    out.db_ok = r1.ok;
    out.db_text = await r1.text();

    // quick search to see what the token can see
    const r2 = await fetch(`https://api.notion.com/v1/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ filter: { value: "database", property: "object" }, page_size: 5 }),
    });
    out.search_status = r2.status;
    out.search_ok = r2.ok;
    out.search_text = await r2.text();
  } catch (e: any) {
    out.ok = false;
    out.error = String(e?.message || e);
  }
  return new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json" },
  });
}
