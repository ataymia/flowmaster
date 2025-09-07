// Proxies GET/POST to Allstar-Auth /schedules, forwarding auth.
// Robust: sends cookies AND Authorization: Bearer <access_token>.

function pickAccessTokenFromCookie(h) {
  const c = h || "";
  const m = c.match(/(?:^|;\s*)access_token=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const qs = url.search || "";
  const upstream = `${env.AUTH_BASE.replace(/\/$/, "")}/schedules${qs}`;

  const cookie = request.headers.get("cookie") || "";
  const token = pickAccessTokenFromCookie(cookie);

  const res = await fetch(upstream, {
    method: "GET",
    headers: {
      cookie,
      origin: request.headers.get("origin") || "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400 }); }

  const username = (body.username || "").trim();
  const date = (body.date || "").trim();
  const rawBlocks = Array.isArray(body.blocks) ? body.blocks : [];

  // sanitize blocks -> minutes, sorted, merged
  function toMin(v) {
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(1440, v | 0));
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ""));
    if (!m) return 0;
    return Math.max(0, Math.min(1440, ((+m[1])*60 + (+m[2])) | 0));
  }
  let blocks = rawBlocks
    .map(b => ({ status: String(b.status || "").trim(), start: toMin(b.start), end: toMin(b.end) }))
    .filter(b => b.status && b.end > b.start)
    .sort((a,b)=> a.start-b.start || a.end-b.end);

  const merged = [];
  for (const b of blocks) {
    const last = merged[merged.length-1];
    if (last && last.status===b.status && last.end===b.start) last.end = b.end;
    else merged.push({ ...b });
  }
  blocks = merged;

  if (!username || !date || !blocks.length) {
    return new Response(JSON.stringify({ error: "username, date, blocks required" }), { status: 400 });
  }

  const upstream = `${env.AUTH_BASE.replace(/\/$/, "")}/schedules`;
  const cookie = request.headers.get("cookie") || "";
  const token = pickAccessTokenFromCookie(cookie);

  const res = await fetch(upstream, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: request.headers.get("origin") || "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ username, date, blocks }),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
