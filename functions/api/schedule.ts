// functions/api/schedule.js
// Proxies GET/POST to the Auth Worker /schedules endpoint
// - forwards cookies so the Worker can authenticate
// - sanitizes blocks before POST (numbers, non-overlapping, start<end)
// - returns the Worker’s response/body/status transparently

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const qs = url.search || "";
  const upstream = `${env.AUTH_BASE.replace(/\/$/, "")}/schedules${qs}`;

  const res = await fetch(upstream, {
    method: "GET",
    headers: {
      // forward browser cookies for auth
      cookie: request.headers.get("cookie") || "",
      // pass through Origin for any allowlist logic in the Worker
      origin: request.headers.get("origin") || "",
    },
    // server-to-server; no CORS/credentials needed beyond cookie forward
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  // body can be: { username, date, blocks:[{status,start,end}|{status,'HH:MM','HH:MM'}] }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400 });
  }

  const username = (body.username || "").trim();
  const date = (body.date || "").trim();
  const rawBlocks = Array.isArray(body.blocks) ? body.blocks : [];

  // sanitize blocks to match Worker expectations (minutes)
  function toMin(v) {
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(1440, v | 0));
    const s = String(v || "");
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return 0;
    return Math.max(0, Math.min(1440, (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) | 0));
  }
  let blocks = rawBlocks
    .map(b => ({
      status: String(b.status || "").trim(),
      start: toMin(b.start),
      end: toMin(b.end),
    }))
    .filter(b => b.status && b.end > b.start);

  // sort and merge abutting same-status blocks
  blocks.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && last.status === b.status && last.end === b.start) {
      last.end = b.end;
    } else {
      merged.push({ ...b });
    }
  }
  blocks = merged;

  if (!username || !date || !blocks.length) {
    return new Response(JSON.stringify({ error: "username, date, blocks required" }), { status: 400 });
  }

  const upstream = `${env.AUTH_BASE.replace(/\/$/, "")}/schedules`;
  const res = await fetch(upstream, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") || "",    // ← forward auth cookies
      origin: request.headers.get("origin") || "",
    },
    body: JSON.stringify({ username, date, blocks }),
  });

  // Bubble up Worker result (including JSON error bodies)
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
