import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
  register: async ({ request, cookies, fetch, url }) => {
    const form = await request.formData();
    const firstName = String(form.get("firstName") ?? "");
    const lastName = String(form.get("lastName") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const values = { firstName, lastName, email };

    if (password !== confirmPassword)
      return fail(400, { ...values, error: "Passwords do not match." });

    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, password }),
    });
    if (!response.ok)
      return fail(400, {
        ...values,
        error: "Use first and last names, a valid email, and a password of at least 10 characters.",
      });

    const result = await response.json();
    cookies.set("kondis_session", result.accessToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: 60 * 60 * 24 * 30,
    });
    throw redirect(303, "/");
  },
};
