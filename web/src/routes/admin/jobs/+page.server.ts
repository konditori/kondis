import { redirect } from "@sveltejs/kit";
import {
  jobControllerGetAllJobStatus,
  jobControllerGetJobHistory,
} from "@kondis/sdk";
import { getServerSdkRequestOptions } from "$lib/server/api";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, locals, parent }) => {
  const { user } = await parent();
  if (user?.role !== "admin") throw redirect(303, "/");

  const options = getServerSdkRequestOptions(locals.kondisFetch ?? fetch);
  const [queues, history] = await Promise.all([
    jobControllerGetAllJobStatus(options),
    jobControllerGetJobHistory({ limit: 75 }, options),
  ]);

  return { queues, history };
};
