// @ts-nocheck
import type { Activity } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load = async ({ fetch }: Parameters<PageServerLoad>[0]) => {
  try {
    const response = await fetch('/api/activities');
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const body = (await response.json()) as { activities: Activity[] };
    return { activities: body.activities, unavailable: false };
  } catch {
    return { activities: [], unavailable: true };
  }
};
