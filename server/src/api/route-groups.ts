import type { OpenAPIHono } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import {
  registerActivityReadOnlyRoutes,
  registerActivityReadRoutes,
  type ActivityReadService,
} from 'src/api/routes/activity';
import {
  registerActivityImageMutationRoutes,
  registerActivityImageReadRoutes,
  registerActivityImageRoutes,
  type ActivityImageRouteService,
} from 'src/api/routes/activity-image';
import { registerAuthRoutes, type AuthRouteService } from 'src/api/routes/auth';
import {
  registerJobCreateRoute,
  registerJobReadRoutes,
  registerJobRoutes,
  type JobRouteService,
} from 'src/api/routes/job';
import {
  registerLiveActivityReadRoutes,
  registerLiveActivityRoutes,
  type LiveActivityRouteService,
} from 'src/api/routes/live-activity';
import {
  registerSocialReadRoutes,
  type SocialActivityReadService,
  type SocialReadService,
} from 'src/api/routes/social';
import { registerSocialMutationRoutes, type SocialMutationService } from 'src/api/routes/social-mutations';
import {
  registerActivityUploadRoute,
  registerTakeoutImportRoutes,
  registerUploadRoutes,
  type UploadRouteService,
} from 'src/api/routes/upload';
import {
  registerUserAvatarRoute,
  registerUserListRoutes,
  registerUserReadRoutes,
  type FileReader,
  type UserAvatarService,
  type UserReadRepository,
} from 'src/api/routes/user';
import {
  registerUserMutationRoutes,
  registerUserProfileMutationRoutes,
  type UserCreationService,
  type UserMutationService,
} from 'src/api/routes/user-mutations';
import type { ConfigRepository } from 'src/contracts/config.repository';
import type { UploadReader } from 'src/types';

export type ApiRouteGroups = {
  activities: ActivityReadService & SocialActivityReadService;
  activityImages: ActivityImageRouteService;
  auth: AuthRouteService & UserCreationService;
  config: Pick<ConfigRepository, 'registrationEnabled' | 'trustProxyHeaders'>;
  files: FileReader;
  jobs: JobRouteService;
  liveActivities: LiveActivityRouteService;
  sessions: import('src/api/auth').ApiSessionLookup;
  social: SocialReadService & SocialMutationService;
  uploads: UploadReader;
  uploadService: UploadRouteService;
  userService: UserAvatarService & UserMutationService;
  users: import('src/api/auth').ApiUserLookup & UserReadRepository;
};

export type ApiRouteGroup = (app: OpenAPIHono<ApiEnv>, dependencies: ApiRouteGroups) => void;

export type WorkerPortableRouteDependencies = {
  activities: ActivityReadService & SocialActivityReadService;
  jobs: Pick<JobRouteService, 'getAllJobStatus' | 'getJobHistory'>;
  liveActivities: Pick<LiveActivityRouteService, 'get' | 'getShared' | 'list'>;
  social: SocialReadService;
  users: UserReadRepository;
};

export type WorkerQueueMutationDependencies = {
  jobs: Pick<JobRouteService, 'create'>;
};

export type WorkerStorageRouteDependencies = {
  activityImages: ActivityImageRouteService;
  files: FileReader;
  uploads: UploadReader;
  uploadService: UploadRouteService;
  userService: UserAvatarService & UserMutationService;
};

export const registerWorkerPortableRouteGroups = (
  app: OpenAPIHono<ApiEnv>,
  dependencies: WorkerPortableRouteDependencies,
): void => {
  registerActivityReadOnlyRoutes(app, dependencies.activities);
  registerUserListRoutes(app, dependencies.users);
  registerSocialReadRoutes(app, dependencies.social, dependencies.activities);
  registerJobReadRoutes(app, dependencies.jobs);
  registerLiveActivityReadRoutes(app, dependencies.liveActivities);
};

export const registerWorkerQueueMutationRoutes = (
  app: OpenAPIHono<ApiEnv>,
  dependencies: WorkerQueueMutationDependencies,
): void => {
  registerJobCreateRoute(app, dependencies.jobs);
};

export const registerWorkerStorageReadRouteGroups = (
  app: OpenAPIHono<ApiEnv>,
  dependencies: WorkerStorageRouteDependencies,
): void => {
  registerActivityImageReadRoutes(app, dependencies.activityImages, dependencies.files);
  registerUserAvatarRoute(app, dependencies.userService, dependencies.files);
};

export const registerWorkerStorageMutationRouteGroups = (
  app: OpenAPIHono<ApiEnv>,
  dependencies: WorkerStorageRouteDependencies,
): void => {
  registerUploadRoutes(app, dependencies.uploadService, dependencies.uploads);
  registerActivityImageMutationRoutes(app, dependencies.activityImages, dependencies.uploads);
  registerUserProfileMutationRoutes(app, dependencies.userService, dependencies.uploads);
};

export const registerWorkerActivityUploadRoute = (
  app: OpenAPIHono<ApiEnv>,
  dependencies: Pick<WorkerStorageRouteDependencies, 'uploads' | 'uploadService'>,
): void => {
  registerActivityUploadRoute(app, dependencies.uploadService, dependencies.uploads);
};

export const registerWorkerTakeoutImportRoutes = (
  app: OpenAPIHono<ApiEnv>,
  dependencies: Pick<WorkerStorageRouteDependencies, 'uploads' | 'uploadService'>,
): void => {
  registerTakeoutImportRoutes(app, dependencies.uploadService, dependencies.uploads);
};

export const registerWorkerStorageRouteGroups = (
  app: OpenAPIHono<ApiEnv>,
  dependencies: WorkerStorageRouteDependencies,
): void => {
  registerWorkerStorageReadRouteGroups(app, dependencies);
  registerWorkerStorageMutationRouteGroups(app, dependencies);
};

export const registerPortableRouteGroups: ApiRouteGroup = (app, dependencies) => {
  registerActivityReadRoutes(app, dependencies.activities);
  registerUserReadRoutes(app, dependencies.users, dependencies.userService, dependencies.files);
  registerSocialReadRoutes(app, dependencies.social, dependencies.activities);
  registerAuthRoutes(app, dependencies.auth, dependencies.users, dependencies.config);
  registerJobRoutes(app, dependencies.jobs);
  registerLiveActivityRoutes(app, dependencies.liveActivities);
};

export const registerAllRouteGroups: ApiRouteGroup = (app, dependencies) => {
  registerPortableRouteGroups(app, dependencies);
  registerActivityImageRoutes(app, dependencies.activityImages, dependencies.uploads, dependencies.files);
  registerUserMutationRoutes(app, dependencies.auth, dependencies.userService, dependencies.uploads);
  registerSocialMutationRoutes(app, dependencies.social);
  registerUploadRoutes(app, dependencies.uploadService, dependencies.uploads);
};
