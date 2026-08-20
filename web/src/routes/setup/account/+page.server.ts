import { fail, redirect } from "@sveltejs/kit";
import { apiUrl } from "$lib/server/api";
import type { Actions, PageServerLoad } from "./$types";

const SETUP_TICKET_COOKIE = "kondis_setup_ticket";

export const load: PageServerLoad = async ({ cookies, locals }) => {
  const response = await locals.kondisFetch(apiUrl("api/v1/auth/setup"), {
    cache: "no-store",
  });
  if (!response.ok || !(await response.json()).setupRequired)
    throw redirect(303, "/login");
  const setupTicket = cookies.get(SETUP_TICKET_COOKIE);
  if (!setupTicket) throw redirect(303, "/setup");
  const validation = await locals.kondisFetch(
    apiUrl("api/v1/auth/setup/validate"),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setupTicket }),
      cache: "no-store",
    },
  );
  if (!validation.ok) {
    cookies.delete(SETUP_TICKET_COOKIE, { path: "/" });
    throw redirect(303, "/setup");
  }
  return {};
};

export const actions: Actions = {
  setup: async ({ request, cookies, fetch }) => {
    const form = await request.formData();
    const firstName = String(form.get("firstName") ?? "");
    const lastName = String(form.get("lastName") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
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
        setupTicket: cookies.get(SETUP_TICKET_COOKIE),
      }),
    });
    if (!response.ok) {
      cookies.delete(SETUP_TICKET_COOKIE, { path: "/" });
      return fail(400, {
        ...values,
        error: "Your verification expired. Enter the setup token again.",
      });
    }
    const result = await response.json();
    cookies.delete(SETUP_TICKET_COOKIE, { path: "/" });
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
