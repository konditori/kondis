import { socialControllerFeed } from "$lib/api";
import {
  activityEventsUrl,
  apiUrl,
  getServerSdkRequestOptions,
} from "$lib/server/api";
import type { ActivityPage, LiveActivity } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
  locals,
  request,
  setHeaders,
  platform,
  url,
}) => {
  const eventsUrl = activityEventsUrl(
    url,
    request.headers.get("x-forwarded-proto"),
    request.headers.get("cf-visitor"),
    platform?.env?.KONDIS_DEMO_MODE === "true",
  );
  try {
    const [liveResponse, body] = await Promise.all([
      locals.kondisFetch(apiUrl("api/v1/live-activities")),
      socialControllerFeed({}, getServerSdkRequestOptions(locals.kondisFetch)),
    ]);
    const liveActivities = liveResponse.ok
      ? ((await liveResponse.json()) as LiveActivity[])
      : [];
    return {
      ...(body as ActivityPage),
      unavailable: false,
      eventsUrl,
      liveActivities,
    };
  } catch {
    // Don't cache this error page, next reload should come from origin
    setHeaders({ "x-kondis-cache-bypass": "1" });
    return {
      activities: [],
      nextCursor: null,
      total: 0,
      unavailable: true,
      eventsUrl,
      liveActivities: [],
    };
  }
};
