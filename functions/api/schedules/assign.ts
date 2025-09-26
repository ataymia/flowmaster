// POST /api/schedules/assign
import { type Env, proxyWithAuth } from "../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) =>
  proxyWithAuth(request, env, "/schedules/assign", { method: "POST", body: request.body });
