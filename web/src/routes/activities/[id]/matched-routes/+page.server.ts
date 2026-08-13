import { error } from "@sveltejs/kit";
import {
  activityControllerListMatchedRoutes,
  getSdkRequestOptions,
} from "$lib/api";
import type { MatchedRouteHistory } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, params }) => {
  try {
    const history = (await activityControllerListMatchedRoutes(
      { id: params.id },
      getSdkRequestOptions(fetch),
    )) as MatchedRouteHistory;
    return { history };
  } catch (requestError) {
    const status = (requestError as { status?: number }).status;
    if (status === 404) error(404, "Activity not found");
    error(503, "Could not load matched routes");
  }
};
