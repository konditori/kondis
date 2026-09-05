import type { OpenAPIHono } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import { registerActivityReadRoutes, type ActivityReadService } from 'src/api/routes/activity';
import { registerActivityImageRoutes, type ActivityImageRouteService } from 'src/api/routes/activity-image';
import { registerAuthRoutes, type AuthRouteService } from 'src/api/routes/auth';
import { registerJobRoutes, type JobRouteService } from 'src/api/routes/job';
import { registerLiveWorkoutRoutes, type LiveWorkoutRouteService } from 'src/api/routes/live-workout';
import { registerSocialReadRoutes, type SocialActivityReadService, type SocialReadService } from 'src/api/routes/social';
import { registerSocialMutationRoutes, type SocialMutationService } from 'src/api/routes/social-mutations';
import { registerUploadRoutes, type UploadRouteService } from 'src/api/routes/upload';
import { registerUserReadRoutes, type FileReader, type UserAvatarService, type UserReadRepository } from 'src/api/routes/user';
import { registerUserMutationRoutes, type UserCreationService, type UserMutationService } from 'src/api/routes/user-mutations';
import type { UploadReader } from 'src/api/uploads';
import type { ConfigPort } from 'src/ports/config.port';

export type ApiRouteGroups = {
  activities: ActivityReadService & SocialActivityReadService;
  activityImages: ActivityImageRouteService;
  auth: AuthRouteService & UserCreationService;
  config: Pick<ConfigPort, 'registrationEnabled' | 'trustProxyHeaders'>;
  files: FileReader;
  jobs: JobRouteService;
  liveWorkouts: LiveWorkoutRouteService;
  sessions: import('src/api/auth').ApiSessionLookup;
  social: SocialReadService & SocialMutationService;
  uploads: UploadReader;
  uploadService: UploadRouteService;
  userService: UserAvatarService & UserMutationService;
  users: import('src/api/auth').ApiUserLookup & UserReadRepository;
};

export type ApiRouteGroup = (app: OpenAPIHono<ApiEnv>, dependencies: ApiRouteGroups) => void;

export const registerPortableRouteGroups: ApiRouteGroup = (app, dependencies) => {
  registerActivityReadRoutes(app, dependencies.activities);
  registerUserReadRoutes(app, dependencies.users, dependencies.userService, dependencies.files);
  registerSocialReadRoutes(app, dependencies.social, dependencies.activities);
  registerAuthRoutes(app, dependencies.auth, dependencies.users, dependencies.config);
  registerJobRoutes(app, dependencies.jobs);
  registerLiveWorkoutRoutes(app, dependencies.liveWorkouts);
};

export const registerAllRouteGroups: ApiRouteGroup = (app, dependencies) => {
  registerPortableRouteGroups(app, dependencies);
  registerActivityImageRoutes(app, dependencies.activityImages, dependencies.uploads, dependencies.files);
  registerUserMutationRoutes(app, dependencies.auth, dependencies.userService, dependencies.uploads);
  registerSocialMutationRoutes(app, dependencies.social);
  registerUploadRoutes(app, dependencies.uploadService, dependencies.uploads);
};
