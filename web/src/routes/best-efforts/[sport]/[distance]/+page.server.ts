import { error, redirect } from "@sveltejs/kit";
import {
  activityControllerListBestEfforts,
  BestEffortSportInput,
  BestEffortType,
} from "$lib/api";
import { getServerSdkRequestOptions } from "$lib/server/api";
import type { BestEffortHistory } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  if (params.sport !== "run" && params.sport !== "ride")
    error(404, "Best effort sport not found");

  let history: BestEffortHistory;
  try {
    // SAFETY: The generated client endpoint returns the BestEffortHistory API contract.
    history = (await activityControllerListBestEfforts(
      {
        // SAFETY: The route guard above narrows sport to the two API-supported values.
        sport: params.sport as BestEffortSportInput,
        // SAFETY: The generated endpoint validates the route distance against its BestEffortType enum.
        $type: params.distance as BestEffortType,
      },
      getServerSdkRequestOptions(locals.kondisFetch),
    )) as BestEffortHistory;
  } catch (requestError) {
    // SAFETY: Generated client errors expose an optional HTTP status code.
    if ((requestError as { status?: number }).status === 400)
      error(404, "Best effort not found");
    return { history: null, unavailable: true };
  }

  const firstAvailable = history.options[0];
  if (
    history.efforts.length === 0 &&
    firstAvailable &&
    !history.options.some(({ type }) => type === history.type)
  ) {
    redirect(307, `/best-efforts/${history.sport}/${firstAvailable.type}`);
  }
  return { history, unavailable: false };
};
