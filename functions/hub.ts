// functions/hub.ts
export const onRequestGet: PagesFunction = async ({ request }) => {
  // Internally fetch /hub.html (no external 30x)
  const url = new URL('/hub.html', request.url);
  return fetch(url.toString(), request);
};
