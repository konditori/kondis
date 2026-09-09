import { error } from "@sveltejs/kit";
import { activityControllerGetById } from "$lib/api";
import { apiUrl, getServerSdkRequestOptions } from "$lib/server/api";
import type { ActivityDetail, LiveWorkout } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  try {
    const response = await activityControllerGetById(
      params.id,
      getServerSdkRequestOptions(locals.kondisFetch),
    );
    const activity = response.data as ActivityDetail;
    return { activity };
  } catch (requestError) {
    const status = (requestError as { status?: number }).status;
    if (status !== 404) error(503, "Could not load this activity");

    const liveResponse = await locals.kondisFetch(
      apiUrl(`api/v1/live-workouts/${params.id}`),
    );
    if (liveResponse.ok)
      return { liveWorkout: (await liveResponse.json()) as LiveWorkout };

    if (liveResponse.status === 404) error(404, "Activity not found");
    error(503, "Could not load this activity");
  }
};
