import {
  activityControllerGetById,
  activityControllerListRecent,
  uploadControllerUploadActivity,
  uploadControllerUploadStravaTakeout,
} from "../../../server/src/open-api/fetch-client";

export function getSdkRequestOptions(fetchImpl?: typeof fetch) {
  return {
    baseUrl: "/api",
    fetch: fetchImpl,
  };
}

export {
  activityControllerGetById,
  activityControllerListRecent,
  uploadControllerUploadActivity,
  uploadControllerUploadStravaTakeout,
};
