import {
  activityControllerGetById,
  activityControllerListBestEfforts,
  activityControllerListRecent,
  activityControllerListTypes,
  activityControllerUpdateById,
  type ActivityTypeSettingsOutput,
  AverageMetric,
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
  activityControllerListTypes,
  activityControllerUpdateById,
  type ActivityTypeSettingsOutput,
  AverageMetric,
  ActivityUpdateSport,
  Sport,
  BestEffortSportInput,
  BestEffortType,
  uploadControllerUploadActivity,
  uploadControllerUploadStravaTakeout,
};
