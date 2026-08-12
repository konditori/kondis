import {
  DEFAULT_UNIT_SYSTEM,
  parseUnitSystem,
  UNIT_SYSTEM_COOKIE,
} from "$lib/units";
import {
  activityControllerListTypes,
  getSdkRequestOptions,
  type ActivityTypeSettingsOutput,
} from "$lib/api";
import { activityEventsUrl } from "$lib/server/api";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies, fetch, url }) => {
  let activityTypes: ActivityTypeSettingsOutput[] = [];
  try {
    activityTypes = await activityControllerListTypes(
      getSdkRequestOptions(fetch),
    );
  } catch {
    // Activity pages already surface API availability; keep settings usable.
  }
  return {
    unitSystem:
      parseUnitSystem(cookies.get(UNIT_SYSTEM_COOKIE)) ?? DEFAULT_UNIT_SYSTEM,
    activityTypes,
    eventsUrl: activityEventsUrl(url),
  };
};
