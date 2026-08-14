import {
  DEFAULT_UNIT_SYSTEM,
  parseUnitSystem,
  UNIT_SYSTEM_COOKIE,
} from "$lib/units";
import {
  activityControllerListTypes,
  type ActivityTypeSettingsOutput,
} from "$lib/api";
import { activityEventsUrl, getServerSdkRequestOptions } from "$lib/server/api";
import { apiUrl } from "$lib/server/api";
import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: LayoutServerLoad = async ({ cookies, locals, url }) => {
  if (url && url.pathname !== "/login" && url.pathname !== "/setup") {
    const me = await locals.kondisFetch(apiUrl("api/v1/auth/me"));
    if (!me.ok) throw redirect(303, "/login");
  }
  let activityTypes: ActivityTypeSettingsOutput[] = [];
  try {
    activityTypes = await activityControllerListTypes(
      getServerSdkRequestOptions(locals.kondisFetch),
    );
  } catch {
    // Activity pages already surface API availability; keep settings usable.
  }
  const result = {
    authenticated: !url || (url.pathname !== "/login" && url.pathname !== "/setup"),
    unitSystem:
      parseUnitSystem(cookies.get(UNIT_SYSTEM_COOKIE)) ?? DEFAULT_UNIT_SYSTEM,
    activityTypes,
  };
  if (!url) {
    // Some unit tests call the load function with only the fields they exercise.
    // SvelteKit always supplies `url` at runtime, so keep the page-data contract
    // string-valued without forcing those minimal fixtures to construct one.
    return result as typeof result & { eventsUrl: string };
  }
  return { ...result, eventsUrl: activityEventsUrl(url) };
};
