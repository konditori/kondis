import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ url }) => {
  const legacyDistance = url.searchParams.get("distance") ?? "5k";
  redirect(308, `/best-efforts/run/${legacyDistance}`);
};
