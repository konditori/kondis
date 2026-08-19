import { fail, redirect } from "@sveltejs/kit";
import { apiUrl } from "$lib/server/api";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const response = await locals.kondisFetch(apiUrl("api/v1/auth/setup"));
  const status = response.ok
    ? await response.json()
    : { setupRequired: false, registrationEnabled: false };
  const setupRequired = status.setupRequired;
  if (setupRequired) throw redirect(303, "/setup");
  return {
    setupRequired: false,
    registrationEnabled: status.registrationEnabled,
  };
};
export const actions: Actions = {
  login: async ({ request, cookies, fetch }) => {
    const form = await request.formData();
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    if (!response.ok) return fail(400, { error: "Invalid email or password" });
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
