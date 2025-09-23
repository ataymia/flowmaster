import { Env, proxyWithAuth } from "./_utils";

export const onRequestGet: PagesFunction<Env>  = async (c) => proxyWithAuth(c.request, c.env, "/presence");
export const onRequestPost: PagesFunction<Env> = async (c) => proxyWithAuth(c.request, c.env, "/presence/ping");
