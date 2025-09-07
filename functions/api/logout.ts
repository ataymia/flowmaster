import { json, setCookie } from './_utils';
export const onRequestPost: PagesFunction = async () => {
  const h = new Headers();
  h.append('Set-Cookie', setCookie('access_token','',{maxAge:0}));
  h.append('Set-Cookie', setCookie('refresh_token','',{maxAge:0}));
  return json({ok:true}, 200, Object.fromEntries(h));
};
