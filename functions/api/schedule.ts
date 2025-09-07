interface Env { AUTH_BASE: string }

function pickAccessTokenFromCookie(h: string | null): string | null {
  const c = h || "";
  const m = c.match(/(?:^|;\s*)access_token=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const url = new URL(request.url);
  const upstream = `${env.AUTH_BASE.replace(/\/$/, "")}/schedules${url.search || ""}`;

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

  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  type Block = { status: string; start: number | string; end: number | string };
  let body: { username?: string; date?: string; blocks?: Block[] };

  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400 }); }

  const username = (body.username || "").trim();
  const date = (body.date || "").trim();
  const rawBlocks = Array.isArray(body.blocks) ? body.blocks : [];

  const toMin = (v: number | string): number => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(1440, v | 0));
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ""));
    if (!m) return 0;
    return Math.max(0, Math.min(1440, ((+m[1]) * 60 + (+m[2])) | 0));
  };

  let blocks = rawBlocks
    .map(b => ({ status: String(b.status || "").trim(), start: toMin(b.start), end: toMin(b.end) }))
    .filter(b => b.status && b.end > b.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: { status: string; start: number; end: number }[] = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && last.status === b.status && last.end === b.start) last.end = b.end;
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
