import {
  activityControllerGetById,
  activityControllerListBestEfforts,
  activityControllerListRecent,
  activityControllerUpdateById,
  ActivityUpdateDtoActivityType as ActivityUpdateSport,
  ActivityType_Output as Sport,
  BestEffortSport as BestEffortSportInput,
  BestEffortType,
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
  activityControllerListBestEfforts,
  activityControllerListRecent,
  activityControllerUpdateById,
  ActivityUpdateSport,
  Sport,
  BestEffortSportInput,
  BestEffortType,
  uploadControllerUploadActivity,
  uploadControllerUploadStravaTakeout,
};
