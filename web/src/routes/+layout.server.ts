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

export const load: LayoutServerLoad = async ({
  cookies,
  locals,
  request,
  url,
}) => {
  let user:
    | {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: "admin" | "user";
        avatarUrl: string | null;
      }
    | undefined;
  const publicLiveView = url?.pathname.startsWith("/live/") ?? false;
  const publicAuthPage =
    url?.pathname === "/login" ||
    url?.pathname === "/setup" ||
    url?.pathname.startsWith("/setup/") ||
    url?.pathname === "/register";
  const activityTypesPromise = activityControllerListTypes(
    getServerSdkRequestOptions(locals.kondisFetch),
  );
  if (url && !publicAuthPage && !publicLiveView) {
    const me = await locals.kondisFetch(apiUrl("api/v1/auth/me"));
    if (!me.ok) {
      const setup = await locals.kondisFetch(apiUrl("api/v1/auth/setup"));
      if (setup.ok && (await setup.json()).setupRequired)
        throw redirect(303, "/setup");
      throw redirect(303, "/login");
    }
    user = (await me.json()) as typeof user;
  }
  let activityTypes: ActivityTypeSettingsOutput[] = [];
  try {
    activityTypes = await activityTypesPromise;
  } catch {
    // Activity pages already surface API availability; keep settings usable.
  }
  const result = {
    user,
    authenticated: !url || (!publicAuthPage && !publicLiveView),
    unitSystem:
      parseUnitSystem(cookies.get(UNIT_SYSTEM_COOKIE)) ?? DEFAULT_UNIT_SYSTEM,
    activityTypes,
  };
  if (!url) {
    return result as typeof result & { eventsUrl: string };
  }
  return {
    ...result,
    eventsUrl: activityEventsUrl(
      url,
      request.headers.get("x-forwarded-proto"),
      request.headers.get("cf-visitor"),
      request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    ),
  };
};
