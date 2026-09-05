import { describe, expect, it, vi } from 'vitest';

import { JobName, JobStatus, QueueName } from 'src/enum';
import { createJobHandlerRegistry } from 'src/job-handler.registry';
import { CLOUD_JOB_CONSUMER, JOB_QUEUE } from 'src/jobs/job-semantics';
import { createPollingJobHandlers } from 'src/jobs/polling-job.consumer';
import type { ActivityImageService } from 'src/services/activity-image.service';
import type { ActivityService } from 'src/services/activity.service';
import type { AuthService } from 'src/services/auth.service';
import type { StorageService } from 'src/services/storage.service';
import type { UploadService } from 'src/services/upload.service';
import type { UserService } from 'src/services/user.service';

const success = () => vi.fn(() => Promise.resolve(JobStatus.Success));

const setup = () => {
  const activityService = {
    handleActivityMetricCompute: success(),
    handleActivityBestEffortCompute: success(),
    handleActivityBestEffortRank: success(),
    handleActivityRouteMatchCompute: success(),
    handleActivityParse: success(),
    handleActivityManualCreate: success(),
    handleActivityParseQueueAll: success(),
    handleActivityDelete: success(),
  } as unknown as ActivityService;
  const activityImageService = {
    handleIngest: success(),
    handleAttach: success(),
    handleGenerateThumbnails: success(),
    handleQueueAll: success(),
  } as unknown as ActivityImageService;
  const authService = { handleCredentialCleanup: success() } as unknown as AuthService;
  const storageService = {
    handleFileDelete: success(),
    handleTemporaryFileCleanup: success(),
  } as unknown as StorageService;
  const uploadService = {
    handleActivityUpload: success(),
    handleLagomTakeout: success(),
  } as unknown as UploadService;
  const userService = { handleAvatarUpload: success() } as unknown as UserService;

  return {
    handlers: createJobHandlerRegistry({
      activityService,
      activityImageService,
      authService,
      storageService,
      uploadService,
      userService,
    }),
    uploadService,
  };
};

describe('createJobHandlerRegistry', () => {
  it('registers every job exactly once with its queue', () => {
    const { handlers } = setup();
    const queues = Object.fromEntries(handlers.map(({ jobName, queueName }) => [jobName, queueName]));

    expect(handlers.map(({ jobName }) => jobName).sort()).toEqual(Object.values(JobName).sort());
    for (const handler of handlers) {
      expect(handler.queueName).toBe(JOB_QUEUE[handler.jobName]);
      expect(handler.cloudConsumer ?? 'node').toBe(CLOUD_JOB_CONSUMER[handler.jobName]);
    }
    expect(queues).toEqual({
      [JobName.AuthCredentialCleanup]: QueueName.BackgroundTask,
      [JobName.ActivityUpload]: QueueName.BackgroundTask,
      [JobName.ActivityMetricCompute]: QueueName.ActivityParsing,
      [JobName.ActivityBestEffortCompute]: QueueName.ActivityParsing,
      [JobName.ActivityBestEffortRank]: QueueName.ActivityParsing,
      [JobName.ActivityRouteMatchCompute]: QueueName.ActivityParsing,
      [JobName.ActivityParse]: QueueName.ActivityParsing,
      [JobName.ActivityManualCreate]: QueueName.ActivityParsing,
      [JobName.ActivityParseQueueAll]: QueueName.BackgroundTask,
      [JobName.ActivityDelete]: QueueName.BackgroundTask,
      [JobName.ActivityImageIngest]: QueueName.ImageProcessing,
      [JobName.ActivityImageAttach]: QueueName.ImageProcessing,
      [JobName.ActivityImageGenerateThumbnails]: QueueName.ImageProcessing,
      [JobName.ActivityImageGenerateQueueAll]: QueueName.BackgroundTask,
      [JobName.LagomTakeoutImport]: QueueName.BackgroundTask,
      [JobName.UserAvatarUpload]: QueueName.ImageProcessing,
      [JobName.FileDelete]: QueueName.Storage,
      [JobName.TemporaryFileCleanup]: QueueName.Storage,
    });
  });

  it('returns bound service handlers', async () => {
    const { handlers, uploadService } = setup();
    const descriptor = handlers.find(({ jobName }) => jobName === JobName.ActivityUpload)!;
    const data = { originalName: 'activity.fit', storagePath: 'temporary/activity.fit' };

    await descriptor.handler(data as never);

    expect(uploadService.handleActivityUpload).toHaveBeenCalledWith(data);
  });

  it('builds a Node cloud registry without Worker-owned handlers', () => {
    const { handlers } = setup();
    const pollingHandlers = createPollingJobHandlers(handlers);

    expect(pollingHandlers[JobName.AuthCredentialCleanup]).toBeUndefined();
    expect(Object.keys(pollingHandlers).sort()).toEqual(
      Object.values(JobName)
        .filter((jobName) => CLOUD_JOB_CONSUMER[jobName] === 'node')
        .sort(),
    );
  });
});
