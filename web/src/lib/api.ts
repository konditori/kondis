import {
  activityControllerGetById,
  activityControllerDeleteById,
  activityControllerListBestEfforts,
  activityControllerListMatchedRoutes,
  activityControllerListRecent,
  activityControllerListTypes,
  activityControllerUpdateById,
  type ActivityTypeSettingsOutput,
  type ActivityType_Output,
  ActivityType,
  AverageMetric,
  type BestEffortSport as BestEffortSportInput,
  type BestEffortType,
  uploadControllerUploadActivity,
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
  jobControllerGetAllJobStatus,
  jobControllerGetJobHistory,
  jobControllerRunQueueCommand,
  type AllJobStatusResponseDtoOutput,
  type JobHistoryResponseDtoOutput,
  type QueueCommandDto as JobQueueCommand,
  type QueueName as JobQueueName,
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
  type ActivityType_Output,
  ActivityType as ActivityUpdateSport,
  ActivityType as Sport,
  AverageMetric,
  type BestEffortSportInput,
  type BestEffortType,
  uploadControllerUploadActivity,
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
  jobControllerGetAllJobStatus,
  jobControllerGetJobHistory,
  jobControllerRunQueueCommand,
  type AllJobStatusResponseDtoOutput,
  type JobHistoryResponseDtoOutput,
  type JobQueueCommand,
  type JobQueueName,
};
