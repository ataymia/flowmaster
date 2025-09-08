// functions/adherence.ts
export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL('/adherence/index.html', request.url);
  return fetch(url.toString(), request);
};
