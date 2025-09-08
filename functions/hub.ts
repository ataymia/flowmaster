// functions/hub.ts
function hasAuthCookie(req: Request) {
  const c = req.headers.get('cookie') || '';
  return /\b(access_token|refresh_token)=/.test(c);
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);

  if (!hasAuthCookie(request)) {
    // Not signed in → back to login (one redirect, max)
    url.pathname = '/';
    url.search = '';
    return Response.redirect(url.toString(), 302);
  }

  // Signed in → serve the file WITHOUT issuing a 30x
  const fileUrl = new URL('/hub.html', request.url);
  return fetch(fileUrl.toString(), request);
};
