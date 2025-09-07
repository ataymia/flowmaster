interface Env { AUTH_BASE: string }

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const upstream = `${env.AUTH_BASE.replace(/\/$/, "")}/auth/login`;
  const body = await request.text();

  const res = await fetch(upstream, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: request.headers.get("origin") || "",
    },
    body,
  });

  // Pass through body and ALL Set-Cookie headers
  const out = new Response(await res.arrayBuffer(), {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });

  // Cloudflare runtime supports getAll / getSetCookie at runtime;
  // use optional chaining to avoid TS complaints.
  const getAll = (res.headers as any).getAll?.bind(res.headers);
  const getSetCookie = (res.headers as any).getSetCookie?.bind(res.headers);
  const cookies: string[] =
    (getAll && getAll("set-cookie")) ||
    (getSetCookie && getSetCookie()) ||
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);

  for (const c of cookies) out.headers.append("set-cookie", c);
  return out;
}
