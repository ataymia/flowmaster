export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    },
  });

export const onRequest = async (ctx) => {
  const url = new URL(ctx.request.url);
  const subpath = url.pathname.replace(/^\/api\/?/, ""); // everything after /api/
  const { API_URL, NOTION_TOKEN, NOTION_DATABASE_ID } = ctx.env;

  const forwardSetCookies = (from, toHeaders) => {
    const setc = from.headers.get("set-cookie");
    if (!setc) return;
    const cookies = Array.isArray(setc) ? setc : [setc];
    for (const c of cookies) toHeaders.append("Set-Cookie", c);
  };

  // Billboard from Notion
  if (subpath === "billboard") {
    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
      return new Response(JSON.stringify({ error: "Notion env not set" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    try {
      const qRes = await fetch(
        `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sorts: [{ property: "Date", direction: "descending" }],
            page_size: 5,
          }),
        }
      );
      const j = await qRes.json();
      if (!qRes.ok) {
        return new Response(
          JSON.stringify({
            items: [],
            note: "notion_error",
            status: qRes.status,
            detail: JSON.stringify(j),
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      const items = (j.results || []).map((r) => {
        const props = r.properties || {};
        const title = (props.Title?.title || [])
          .map((t) => t.plain_text)
          .join("") || "Update";
        const text = (props.Text?.rich_text || [])
          .map((t) => t.plain_text)
          .join("");
        const date =
          props.Date?.date?.start || props["Date 1"]?.date?.start || null;
        const vis1 = props["Select"]?.select?.name || null;
        const vis2 = props["Select 1"]?.select?.name || null;
        const vis3 = props["Select 2"]?.select?.name || null;
        return { id: r.id, title, text, date, vis: [vis1, vis2, vis3].filter(Boolean) };
      });
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ items: [], note: "notion_exception" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // whoami → /me passthrough
  if (subpath === "whoami") {
    const upstream = await fetch(`${API_URL}/me`, {
      headers: { cookie: ctx.request.headers.get("cookie") || "" },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    const body = await upstream.text();
    const h = new Headers({
      "content-type": upstream.headers.get("content-type") || "application/json",
    });
    forwardSetCookies(upstream, h);
    return new Response(body, { status: upstream.status, headers: h });
  }

  // Generic proxy to Worker for everything else
  const target = `${API_URL}/${subpath}`;
  const init = {
    method: ctx.request.method,
    headers: new Headers(ctx.request.headers),
    body: undefined,
    redirect: "manual",
    cf: { cacheTtl: 0, cacheEverything: false },
  };
  init.headers.delete("host");
  if (!["GET", "HEAD"].includes(ctx.request.method)) {
    init.body = ctx.request.body;
  }

  const upstream = await fetch(target, init);
  const resHeaders = new Headers(upstream.headers);
  const outHeaders = new Headers();
  for (const [k, v] of resHeaders.entries()) {
    if (k.toLowerCase() === "set-cookie") continue;
    outHeaders.set(k, v);
  }
  forwardSetCookies(upstream, outHeaders);

  const body = await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers: outHeaders });
};
