import { Env, ensureAccess, proxyWithAuth } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async (c) => {
  const acc = ensureAccess(c.request); if (!acc.ok) return acc.response;
  return proxyWithAuth(c.request, c.env, "/users");
};
export const onRequestPost: PagesFunction<Env> = async (c) => proxyWithAuth(c.request, c.env, "/users");
export const onRequestPatch: PagesFunction<Env> = async (c) =>
  proxyWithAuth(c.request, c.env, `/users/${c.params["*"] || c.request.url.split("/").pop()}`);
export const onRequestDelete: PagesFunction<Env> = async (c) =>
  proxyWithAuth(c.request, c.env, `/users/${c.params["*"] || c.request.url.split("/").pop()}`);
