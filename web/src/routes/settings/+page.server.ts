import { fail } from "@sveltejs/kit";
import { parseUnitSystem, UNIT_SYSTEM_COOKIE } from "$lib/units";
import type { Actions } from "./$types";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const actions = {
  default: async ({ cookies, request, url }) => {
    const formData = await request.formData();
    const unitSystem = parseUnitSystem(formData.get("unitSystem"));
    if (!unitSystem) {
      return fail(400, { error: "Choose metric or imperial units." });
    }

    cookies.set(UNIT_SYSTEM_COOKIE, unitSystem, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: ONE_YEAR_SECONDS,
    });

    return { saved: true };
  },
} satisfies Actions;
