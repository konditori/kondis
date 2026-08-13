import { activityControllerListRecent } from "$lib/api";
import { activityEventsUrl, getServerSdkRequestOptions } from "$lib/server/api";
import type { ActivityPage } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const eventsUrl = activityEventsUrl(url);
  try {
    const body = (await activityControllerListRecent(
      {},
      getServerSdkRequestOptions(locals.kondisFetch),
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
