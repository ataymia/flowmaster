// functions/adherence.ts
function hasAuthCookie(req: Request) {
  const c = req.headers.get('cookie') || '';
  return /\b(access_token|refresh_token)=/.test(c);
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);

  if (!hasAuthCookie(request)) {
    url.pathname = '/';
    url.search = '';
    return Response.redirect(url.toString(), 302);
  }

  const fileUrl = new URL('/adherence/index.html', request.url);
  return fetch(fileUrl.toString(), request);
};
