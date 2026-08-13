import { error } from "@sveltejs/kit";
import { activityControllerListMatchedRoutes } from "$lib/api";
import { getServerSdkRequestOptions } from "$lib/server/api";
import type { MatchedRouteHistory } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  try {
    const history = (await activityControllerListMatchedRoutes(
      { id: params.id },
      getServerSdkRequestOptions(locals.kondisFetch),
    )) as MatchedRouteHistory;
    return { history };
  } catch (requestError) {
    const status = (requestError as { status?: number }).status;
    if (status === 404) error(404, "Activity not found");
    error(503, "Could not load matched routes");
  }
};
