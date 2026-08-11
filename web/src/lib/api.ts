import {
  activityControllerGetById,
  activityControllerListRecent,
  activityControllerUpdateById,
  Sport,
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
  activityControllerUpdateById,
  Sport,
  uploadControllerUploadActivity,
  uploadControllerUploadStravaTakeout,
};
