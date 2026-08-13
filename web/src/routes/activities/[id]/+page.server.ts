import { error } from "@sveltejs/kit";
import { activityControllerGetById } from "$lib/api";
import { getServerSdkRequestOptions } from "$lib/server/api";
import type { ActivityDetail } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  try {
    const activity = (await activityControllerGetById(
      { id: params.id },
      getServerSdkRequestOptions(locals.kondisFetch),
    )) as ActivityDetail;
    return { activity };
  } catch (requestError) {
    const status = (requestError as { status?: number }).status;
    if (status === 404) error(404, "Activity not found");
    error(503, "Could not load this activity");
  }
};
