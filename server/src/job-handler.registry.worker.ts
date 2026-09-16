import { JobName } from 'src/enum';
import { createJobHandlers, type AnyJobHandlerDescriptor, type JobHandlers } from 'src/jobs/job-handler';
import { JOB_QUEUE } from 'src/jobs/job-semantics';
import type { ActivityService } from 'src/services/activity.service';
import type { AuthService } from 'src/services/auth.service';
import type { WorkerUploadService } from 'src/services/worker-upload.service';

const unavailableWorkerStorage = () => Promise.reject(new Error('STORAGE_BUCKET is required for activity processing'));

type WorkerServices = {
  authService: Pick<AuthService, 'handleCredentialCleanup'>;
  activityService?: Pick<
    ActivityService,
    | 'handleActivityBestEffortCompute'
    | 'handleActivityBestEffortRank'
    | 'handleActivityMetricCompute'
    | 'handleActivityManualCreate'
    | 'handleActivityParse'
    | 'handleActivityRouteMatchCompute'
  >;
  uploadService?: Pick<WorkerUploadService, 'handleActivityUpload'>;
};

export const createWorkerJobHandlers = ({
  authService,
  activityService,
  uploadService,
}: WorkerServices): JobHandlers => {
  const handlers: JobHandlers = {
    [JobName.AuthCredentialCleanup]: authService.handleCredentialCleanup.bind(authService),
    [JobName.ActivityUpload]: uploadService?.handleActivityUpload.bind(uploadService) ?? unavailableWorkerStorage,
    [JobName.ActivityParse]: activityService?.handleActivityParse.bind(activityService) ?? unavailableWorkerStorage,
    [JobName.ActivityMetricCompute]:
      activityService?.handleActivityMetricCompute.bind(activityService) ?? unavailableWorkerStorage,
    [JobName.ActivityBestEffortCompute]:
      activityService?.handleActivityBestEffortCompute.bind(activityService) ?? unavailableWorkerStorage,
    [JobName.ActivityBestEffortRank]:
      activityService?.handleActivityBestEffortRank.bind(activityService) ?? unavailableWorkerStorage,
    [JobName.ActivityRouteMatchCompute]:
      activityService?.handleActivityRouteMatchCompute.bind(activityService) ?? unavailableWorkerStorage,
    [JobName.ActivityManualCreate]:
      activityService?.handleActivityManualCreate.bind(activityService) ?? unavailableWorkerStorage,
  };
  return createJobHandlers(
    Object.entries(handlers).map(([name, handler]) => ({
      jobName: name as JobName,
      queueName: JOB_QUEUE[name as JobName],
      handler,
      label: `Worker.${name}`,
      cloudConsumer: 'worker',
    })) as AnyJobHandlerDescriptor[],
    ['worker'],
  );
};
