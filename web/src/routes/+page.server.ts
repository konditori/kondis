import { activityControllerListRecent, getSdkRequestOptions } from "$lib/api";
import { activityEventsUrl } from "$lib/server/api";
import type { ActivityPage } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, url }) => {
  const eventsUrl = activityEventsUrl(url);
  try {
    const body = (await activityControllerListRecent(
      {},
      getSdkRequestOptions(fetch),
    )) as ActivityPage;
    return { ...body, unavailable: false, eventsUrl };
  } catch {
    return {
      activities: [],
      nextCursor: null,
      total: 0,
      unavailable: true,
      eventsUrl,
    };
  }
};
