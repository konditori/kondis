import { activityControllerListRecent, getSdkRequestOptions } from "$lib/api";
import type { ActivityPage } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const body = (await activityControllerListRecent(
      {},
      getSdkRequestOptions(fetch),
    )) as ActivityPage;
    return { ...body, unavailable: false };
  } catch {
    return { activities: [], nextCursor: null, total: 0, unavailable: true };
  }
};
