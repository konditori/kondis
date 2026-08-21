import { socialControllerFeed } from "$lib/api";
import {
  activityEventsUrl,
  apiUrl,
  getServerSdkRequestOptions,
} from "$lib/server/api";
import type { ActivityPage, LiveWorkout } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request, url }) => {
  const eventsUrl = activityEventsUrl(
    url,
    request.headers.get("x-forwarded-proto"),
    request.headers.get("cf-visitor"),
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  try {
    const [liveResponse, body] = await Promise.all([
      locals.kondisFetch(apiUrl("api/v1/live-workouts")),
      socialControllerFeed(
        {},
        getServerSdkRequestOptions(locals.kondisFetch),
      ) as Promise<ActivityPage>,
    ]);
    const liveWorkouts = liveResponse.ok
      ? ((await liveResponse.json()) as LiveWorkout[])
      : [];
    return { ...body, unavailable: false, eventsUrl, liveWorkouts };
  } catch {
    return {
      activities: [],
      nextCursor: null,
      total: 0,
      unavailable: true,
      eventsUrl,
      liveWorkouts: [],
    };
  }
};
