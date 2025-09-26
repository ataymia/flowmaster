import { type Env, proxyWithSession } from "./_utils";
export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  proxyWithSession(request, env, "/schedules/assign", { method: "POST", body: request.body });
