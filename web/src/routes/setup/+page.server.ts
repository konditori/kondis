import { fail, redirect } from "@sveltejs/kit";
import { apiUrl } from "$lib/server/api";
import type { Actions, PageServerLoad } from "./$types";
export const load: PageServerLoad = async ({ locals }) => {
  const response = await locals.kondisFetch(apiUrl("api/v1/auth/setup"), {
    cache: "no-store",
  });
  if (!response.ok || !(await response.json()).setupRequired)
    throw redirect(303, "/login");
  return {};
};
export const actions: Actions = {
  verify: async ({ request, cookies, fetch }) => {
    const form = await request.formData();
    const setupToken = String(form.get("setupToken") ?? "");
    const response = await fetch("/api/v1/auth/setup/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setupToken }),
    });
    if (!response.ok) {
      const error =
        response.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : "That setup token is not valid.";
      return fail(400, {
        error,
      });
    }
    const result = await response.json();
    cookies.set("kondis_setup_ticket", result.token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      maxAge: 10 * 60,
    });
    throw redirect(303, "/setup/account");
  },
};
