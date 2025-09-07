// functions/api/schedules.ts
import { proxyWithAuth } from './_utils';

export const onRequestGet: PagesFunction = async (ctx) => {
  // proxy /api/schedules?user=&date=  ->  Worker /schedules?user=&date=
  const url = new URL(ctx.request.url);
  const qs = url.search ? url.search : '';
  return proxyWithAuth(ctx, `/schedules${qs}`);
};

export const onRequestPost: PagesFunction = async (ctx) => {
  // Pass JSON body to Worker /schedules (create/update)
  const body = await ctx.request.text();
  return proxyWithAuth(ctx, '/schedules', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
};
