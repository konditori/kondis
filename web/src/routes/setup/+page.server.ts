import { fail, redirect } from "@sveltejs/kit";
import { apiUrl } from "$lib/server/api";
import type { Actions, PageServerLoad } from "./$types";
export const load: PageServerLoad = async ({ locals }) => {
  const response = await locals.kondisFetch(apiUrl("api/v1/auth/setup"));
  if (!response.ok || !(await response.json()).setupRequired)
    throw redirect(303, "/login");
  return {};
};
export const actions: Actions = {
  setup: async ({ request, cookies, fetch }) => {
    const form = await request.formData();
    const firstName = String(form.get("firstName") ?? "");
    const lastName = String(form.get("lastName") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const setupToken = String(form.get("setupToken") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const values = { firstName, lastName, email };
    if (password !== confirmPassword)
      return fail(400, { ...values, error: "Passwords do not match." });
    const response = await fetch("/api/v1/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        setupToken,
      }),
    });
    if (!response.ok)
      return fail(400, {
        ...values,
        error: "Check the setup token and account details, then try again.",
      });
    const result = await response.json();
    cookies.set("kondis_session", result.accessToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
    });
    throw redirect(303, "/");
  },
};
