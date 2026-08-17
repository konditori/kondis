import { apiUrl } from "$lib/server/api";
import type { LiveWorkout } from "$lib/types";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  const response = await locals.kondisFetch(
    apiUrl(`api/v1/live-workouts/${params.id}`),
  );
  if (!response.ok) throw error(response.status, "Live workout not found.");
  return { workout: (await response.json()) as LiveWorkout };
};
