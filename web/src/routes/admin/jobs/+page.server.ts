import { redirect } from "@sveltejs/kit";
import {
  jobControllerGetAllJobStatus,
  jobControllerGetJobHistory,
} from "@kondis/sdk";
import { getServerSdkRequestOptions } from "$lib/server/api";
import type { PageServerLoad } from "./$types";

const HISTORY_PAGE_SIZE = 75;

export const load: PageServerLoad = async ({ fetch, locals, parent, url }) => {
  const { user } = await parent();
  if (user?.role !== "admin") throw redirect(303, "/");

  const requestedPage = Number(url.searchParams.get("jobsPage"));
  const requestedCount = Number(url.searchParams.get("jobsCount"));
  const page =
    Number.isInteger(requestedPage) && requestedPage > 1 ? requestedPage : 1;
  const count =
    Number.isInteger(requestedCount) && requestedCount > HISTORY_PAGE_SIZE
      ? Math.min(requestedCount, 200)
      : 0;
  const offset = count > 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE;
  const limit = count > 0 ? count : HISTORY_PAGE_SIZE;
  const options = getServerSdkRequestOptions(locals.kondisFetch ?? fetch);
  const [queues, history] = await Promise.all([
    jobControllerGetAllJobStatus(options),
    jobControllerGetJobHistory({ limit, offset }, options),
  ]);

  return { queues, history, historyOffset: offset };
};
