import { error } from "@sveltejs/kit";
import type { ActivityDetail } from "$lib/types";
import { apiUrl } from "$lib/server/api";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, params }) => {
  const response = await fetch(apiUrl(`activities/${params.id}`));
  if (response.status === 404) error(404, "Activity not found");
  if (!response.ok) error(503, "Could not load this activity");
  return { activity: (await response.json()) as ActivityDetail };
};
