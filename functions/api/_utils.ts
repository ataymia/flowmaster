// functions/api/_utils.ts

export interface Env {
  AUTH_BASE: string;            // e.g., https://allstar-auth.your-worker.workers.dev
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
}

/* ---------------- JSON helper ---------------- */
export function json(data: any, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
  });
}

/* ---------------- Cookie + session helpers ---------------- */
export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get('cookie') || '';
  const map: Record<string, string> = {};
  raw.split(';').forEach(kv => {
    const i = kv.indexOf('=');
    if (i > -1) {
      const k = kv.slice(0, i).trim();
      const v = kv.slice(i + 1).trim();
      if (k) map[k] = decodeURIComponent(v);
    }
  });
  return map;
}

export function getAccessFromRequest(req: Request): string | null {
  const c = parseCookies(req);
  // Accept either cookie name (your hub uses "allstar_at")
  return c['access_token'] || c['allstar_at'] || null;
}

export function ensureAccess(req: Request) {
  const tok = getAccessFromRequest(req);
  if (!tok) {
    return {
      ok: false as const,
      response: json({ error: 'unauthorized' }, 401, { 'cache-control': 'no-store' })
    };
  }
  return { ok: true as const, token: tok };
}

/** Build headers for upstream calls, forwarding session */
export function buildSessionHeaders(req: Request, extra?: HeadersInit) {
  const h = new Headers(extra || {});
  const tok = getAccessFromRequest(req);
  if (tok) {
    if (!h.has('authorization')) h.set('authorization', `Bearer ${tok}`);
    // Fallback cookie for upstreams that read cookies instead of Authorization
    if (!h.has('cookie')) h.set('cookie', `access_token=${encodeURIComponent(tok)}`);
  }
  const ct = req.headers.get('content-type');
  if (ct && !h.has('content-type')) h.set('content-type', ct);
  return h;
}

/** Forward all Set-Cookie headers from upstream to caller */
export function forwardSetCookies(up: Response, out: Headers) {
  const any = up.headers as any;
  if (typeof any.getSetCookie === 'function') {
    (any.getSetCookie() || []).forEach((line: string) => out.append('set-cookie', line));
    return;
  }
  const single = up.headers.get('set-cookie');
  if (single) out.append('set-cookie', single);
}

/** Minimal proxy that also forwards Set-Cookie back */
export async function proxyWithSession(req: Request, env: Env, path: string) {
  const url = path.startsWith('http') ? path : `${env.AUTH_BASE}${path}`;
  const up = await fetch(url, {
    method: req.method,
    headers: buildSessionHeaders(req),
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    redirect: 'manual',
  });
  const outH = new Headers();
  const ct = up.headers.get('content-type');
  if (ct) outH.set('content-type', ct);
  forwardSetCookies(up, outH);
  return new Response(up.body, { status: up.status, headers: outH });
}

/** (Compat) upstream helper for any old callers still importing it */
export function upstream(req: Request, env: Env, path: string, init: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${env.AUTH_BASE}${path}`;
  const headers = buildSessionHeaders(req, init.headers);
  return fetch(url, { ...init, headers, redirect: 'manual' });
}
