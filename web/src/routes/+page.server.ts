import type { ActivityPage } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const response = await fetch("/api/activities");
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const body = (await response.json()) as ActivityPage;
    return { ...body, unavailable: false };
  } catch {
    return { activities: [], nextCursor: null, total: 0, unavailable: true };
  }
};
