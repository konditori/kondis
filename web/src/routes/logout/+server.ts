import { redirect } from "@sveltejs/kit";
import { apiUrl } from "$lib/server/api";
import type { RequestHandler } from "./$types";

const logout: RequestHandler = async ({ cookies, locals }) => {
  await locals
    .kondisFetch(apiUrl("api/v1/auth/logout"), { method: "POST", signal: AbortSignal.timeout(2_000) })
    .catch(() => undefined);
  cookies.delete("kondis_session", { path: "/" });
  throw redirect(303, "/login");
};

export const POST = logout;
