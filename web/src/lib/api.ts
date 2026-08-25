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
  socialControllerFeed,
  socialControllerPeople,
  socialControllerPerson,
  socialControllerActivities,
  socialControllerSend,
  socialControllerCancel,
  socialControllerUnfollow,
  socialControllerBlock,
  socialControllerUnblock,
  socialControllerRequests,
  socialControllerAccept,
  socialControllerIgnore,
  socialControllerLike,
  socialControllerUnlike,
  socialControllerComments,
  socialControllerComment,
  socialControllerUpdateComment,
  socialControllerDeleteComment,
  socialControllerLikers,
  socialControllerNotifications,
  socialControllerMarkNotificationsRead,
} from "@kondis/sdk";

export function getSdkRequestOptions(fetchImpl?: typeof fetch) {
  return {
    baseUrl: "/api/v1",
    fetch: fetchImpl,
  };
}

export async function activityImageUpload(
  activityId: string,
  file: File,
  caption?: string,
): Promise<unknown> {
  const body = new FormData();
  body.append("file", file);
  if (caption?.trim()) body.append("caption", caption.trim());
  const response = await fetch(`/api/v1/activities/${activityId}/images`, {
    method: "POST",
    body,
  });
  if (!response.ok) throw new Error(`Image upload failed (${response.status})`);
  return response.json();
}

export async function activityImageDelete(
  activityId: string,
  imageId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/activities/${activityId}/images/${imageId}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`Image delete failed (${response.status})`);
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
  socialControllerFeed,
  socialControllerPeople,
  socialControllerPerson,
  socialControllerActivities,
  socialControllerSend,
  socialControllerCancel,
  socialControllerUnfollow,
  socialControllerBlock,
  socialControllerUnblock,
  socialControllerRequests,
  socialControllerAccept,
  socialControllerIgnore,
  socialControllerLike,
  socialControllerUnlike,
  socialControllerComments,
  socialControllerComment,
  socialControllerUpdateComment,
  socialControllerDeleteComment,
  socialControllerLikers,
  socialControllerNotifications,
  socialControllerMarkNotificationsRead,
};
