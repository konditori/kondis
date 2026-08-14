import {
  activityControllerGetById,
  activityControllerDeleteById,
  activityControllerListBestEfforts,
  activityControllerListMatchedRoutes,
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
  uploadControllerGetStravaTakeoutStatus,
} from "../../../server/src/open-api/fetch-client";

export function getSdkRequestOptions(fetchImpl?: typeof fetch) {
  return {
    baseUrl: "/api/v1",
    fetch: fetchImpl,
  };
}

export {
  activityControllerGetById,
  activityControllerDeleteById,
  activityControllerListBestEfforts,
  activityControllerListMatchedRoutes,
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
  uploadControllerGetStravaTakeoutStatus,
};
