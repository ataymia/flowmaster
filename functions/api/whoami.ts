// functions/api/whoami.ts
import { proxyWithAuth } from './_utils';

export const onRequestGet: PagesFunction = async (ctx) => {
  // upstream /me reads access_token; our proxy carries cookies through
  return proxyWithAuth(ctx, '/me');
};
