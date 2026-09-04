import { JobName, QueueName } from 'src/enum';
import type { JobHandlerDescriptor } from 'src/repositories/job.repository';
import type { ActivityImageService } from 'src/services/activity-image.service';
import type { ActivityService } from 'src/services/activity.service';
import type { AuthService } from 'src/services/auth.service';
import type { StorageService } from 'src/services/storage.service';
import type { UploadService } from 'src/services/upload.service';
import type { UserService } from 'src/services/user.service';

type JobHandlerRegistryServices = {
  activityService: ActivityService;
  activityImageService: ActivityImageService;
  authService: AuthService;
  storageService: StorageService;
  uploadService: UploadService;
  userService: UserService;
};

export const createJobHandlerRegistry = ({
  activityService,
  activityImageService,
  authService,
  storageService,
  uploadService,
  userService,
}: JobHandlerRegistryServices) => {
  const handlers: { [T in JobName]: JobHandlerDescriptor<T> } = {
    [JobName.AuthCredentialCleanup]: {
      jobName: JobName.AuthCredentialCleanup,
      queueName: QueueName.BackgroundTask,
      handler: authService.handleCredentialCleanup.bind(authService),
      label: 'AuthService.handleCredentialCleanup',
      cloudConsumer: 'worker',
    },
    [JobName.ActivityUpload]: {
      jobName: JobName.ActivityUpload,
      queueName: QueueName.BackgroundTask,
      handler: uploadService.handleActivityUpload.bind(uploadService),
      label: 'UploadService.handleActivityUpload',
    },
    [JobName.ActivityMetricCompute]: {
      jobName: JobName.ActivityMetricCompute,
      queueName: QueueName.ActivityParsing,
      handler: activityService.handleActivityMetricCompute.bind(activityService),
      label: 'ActivityService.handleActivityMetricCompute',
    },
    [JobName.ActivityBestEffortCompute]: {
      jobName: JobName.ActivityBestEffortCompute,
      queueName: QueueName.ActivityParsing,
      handler: activityService.handleActivityBestEffortCompute.bind(activityService),
      label: 'ActivityService.handleActivityBestEffortCompute',
    },
    [JobName.ActivityBestEffortRank]: {
      jobName: JobName.ActivityBestEffortRank,
      queueName: QueueName.ActivityParsing,
      handler: activityService.handleActivityBestEffortRank.bind(activityService),
      label: 'ActivityService.handleActivityBestEffortRank',
    },
    [JobName.ActivityRouteMatchCompute]: {
      jobName: JobName.ActivityRouteMatchCompute,
      queueName: QueueName.ActivityParsing,
      handler: activityService.handleActivityRouteMatchCompute.bind(activityService),
      label: 'ActivityService.handleActivityRouteMatchCompute',
    },
    [JobName.ActivityParse]: {
      jobName: JobName.ActivityParse,
      queueName: QueueName.ActivityParsing,
      handler: activityService.handleActivityParse.bind(activityService),
      label: 'ActivityService.handleActivityParse',
    },
    [JobName.ActivityManualCreate]: {
      jobName: JobName.ActivityManualCreate,
      queueName: QueueName.ActivityParsing,
      handler: activityService.handleActivityManualCreate.bind(activityService),
      label: 'ActivityService.handleActivityManualCreate',
    },
    [JobName.ActivityParseQueueAll]: {
      jobName: JobName.ActivityParseQueueAll,
      queueName: QueueName.BackgroundTask,
      handler: activityService.handleActivityParseQueueAll.bind(activityService),
      label: 'ActivityService.handleActivityParseQueueAll',
    },
    [JobName.ActivityDelete]: {
      jobName: JobName.ActivityDelete,
      queueName: QueueName.BackgroundTask,
      handler: activityService.handleActivityDelete.bind(activityService),
      label: 'ActivityService.handleActivityDelete',
    },
    [JobName.ActivityImageIngest]: {
      jobName: JobName.ActivityImageIngest,
      queueName: QueueName.ImageProcessing,
      handler: activityImageService.handleIngest.bind(activityImageService),
      label: 'ActivityImageService.handleIngest',
    },
    [JobName.ActivityImageAttach]: {
      jobName: JobName.ActivityImageAttach,
      queueName: QueueName.ImageProcessing,
      handler: activityImageService.handleAttach.bind(activityImageService),
      label: 'ActivityImageService.handleAttach',
    },
    [JobName.ActivityImageGenerateThumbnails]: {
      jobName: JobName.ActivityImageGenerateThumbnails,
      queueName: QueueName.ImageProcessing,
      handler: activityImageService.handleGenerateThumbnails.bind(activityImageService),
      label: 'ActivityImageService.handleGenerateThumbnails',
    },
    [JobName.ActivityImageGenerateQueueAll]: {
      jobName: JobName.ActivityImageGenerateQueueAll,
      queueName: QueueName.BackgroundTask,
      handler: activityImageService.handleQueueAll.bind(activityImageService),
      label: 'ActivityImageService.handleQueueAll',
    },
    [JobName.LagomTakeoutImport]: {
      jobName: JobName.LagomTakeoutImport,
      queueName: QueueName.BackgroundTask,
      handler: uploadService.handleLagomTakeout.bind(uploadService),
      label: 'UploadService.handleLagomTakeout',
    },
    [JobName.UserAvatarUpload]: {
      jobName: JobName.UserAvatarUpload,
      queueName: QueueName.ImageProcessing,
      handler: userService.handleAvatarUpload.bind(userService),
      label: 'UserService.handleAvatarUpload',
    },
    [JobName.FileDelete]: {
      jobName: JobName.FileDelete,
      queueName: QueueName.Storage,
      handler: storageService.handleFileDelete.bind(storageService),
      label: 'StorageService.handleFileDelete',
    },
    [JobName.TemporaryFileCleanup]: {
      jobName: JobName.TemporaryFileCleanup,
      queueName: QueueName.Storage,
      handler: storageService.handleTemporaryFileCleanup.bind(storageService),
      label: 'StorageService.handleTemporaryFileCleanup',
    },
  };

  return Object.values(handlers);
};
