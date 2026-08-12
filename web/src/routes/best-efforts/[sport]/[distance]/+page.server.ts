import { error, redirect } from "@sveltejs/kit";
import {
  activityControllerListBestEfforts,
  BestEffortSportInput,
  BestEffortType,
  getSdkRequestOptions,
} from "$lib/api";
import type { BestEffortHistory } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, params }) => {
  if (params.sport !== "run" && params.sport !== "ride")
    error(404, "Best effort sport not found");

  let history: BestEffortHistory;
  try {
    history = (await activityControllerListBestEfforts(
      {
        sport: params.sport as BestEffortSportInput,
        $type: params.distance as BestEffortType,
      },
      getSdkRequestOptions(fetch),
    )) as BestEffortHistory;
  } catch (requestError) {
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
