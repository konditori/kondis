import { apiUrl } from "$lib/server/api";
import type { LiveActivity } from "$lib/types";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch }) => {
  const response = await fetch(
    apiUrl(`api/v1/live-activities/shared/${params.token}`),
  );
  if (!response.ok)
    throw error(response.status, "This live tracking link is unavailable.");
  return {
    activity: (await response.json()) as LiveActivity,
    token: params.token,
  };
};
