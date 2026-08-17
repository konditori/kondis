import { error } from "@sveltejs/kit";
import { activityControllerGetById } from "$lib/api";
import { getServerSdkRequestOptions } from "$lib/server/api";
import type { ActivityDetail } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  try {
    // SAFETY: The generated client endpoint returns the ActivityDetail API contract.
    const activity = (await activityControllerGetById(
      { id: params.id },
      getServerSdkRequestOptions(locals.kondisFetch),
    )) as ActivityDetail;
    return { activity };
  } catch (requestError) {
    // SAFETY: Generated client errors expose an optional HTTP status code.
    const status = (requestError as { status?: number }).status;
    if (status === 404) error(404, "Activity not found");
    error(503, "Could not load this activity");
  }
};
