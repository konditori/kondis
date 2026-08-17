import { apiUrl } from "$lib/server/api";
import type { LiveWorkout } from "$lib/types";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch }) => {
  const response = await fetch(
    apiUrl(`api/v1/live-workouts/shared/${params.token}`),
  );
  if (!response.ok)
    throw error(response.status, "This live tracking link is unavailable.");
  return {
    workout: (await response.json()) as LiveWorkout,
    token: params.token,
  };
};
