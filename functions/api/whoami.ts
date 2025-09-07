// functions/api/whoami.ts
import { json, proxyWithAuth } from './_utils';

export const onRequestGet: PagesFunction = async (ctx) => {
  // Call the Worker /me endpoint with the browser cookies proxied
  const res = await proxyWithAuth(ctx, '/me');

  // If Worker says OK, pass data through (and mark authed:true)
  if (res.ok) {
    try {
      const body = await res.json();
      return json({ authed: true, ...body }, 200);
    } catch {
      // Non-JSON body; just stream it back
      return res;
    }
  }

  // Unauthorized – normalize to small JSON body so the hub can redirect to /hub
  if (res.status === 401) {
    return json({ authed: false, reason: 'no cookie' }, 401);
  }

  // Anything else – proxy as-is
  return res;
};
