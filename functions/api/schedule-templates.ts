// GET(list) / POST(create) / DELETE(/:id)
import { type Env, proxyWithSession } from "../_utils";
export const onRequestGet: PagesFunction<Env> = ({ request, env }) =>
  proxyWithSession(request, env, "/schedule-templates");
export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  proxyWithSession(request, env, "/schedule-templates", { method: "POST", body: request.body });
export const onRequestDelete: PagesFunction<Env> = ({ request, env }) => {
  const id = new URL(request.url).pathname.split("/").pop();
  return proxyWithSession(request, env, `/schedule-templates/${id}`, { method: "DELETE" });
};
