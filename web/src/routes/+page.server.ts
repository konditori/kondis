import { activityControllerListRecent } from "$lib/api";
import { activityEventsUrl, getServerSdkRequestOptions } from "$lib/server/api";
import { apiUrl } from "$lib/server/api";
import type { ActivityPage, LiveWorkout } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const eventsUrl = activityEventsUrl(url);
  const liveResponse = await locals.kondisFetch(apiUrl("api/v1/live-workouts"));
  const liveWorkouts = liveResponse.ok
    ? ((await liveResponse.json()) as LiveWorkout[])
    : [];
  try {
    const body = (await activityControllerListRecent(
      {},
      getServerSdkRequestOptions(locals.kondisFetch),
    )) as ActivityPage;
    return { ...body, unavailable: false, eventsUrl, liveWorkouts };
  } catch {
    return {
      activities: [],
      nextCursor: null,
      total: 0,
      unavailable: true,
      eventsUrl,
      liveWorkouts,
    };
  }
};
