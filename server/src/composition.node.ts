import { createDatabase } from 'src/db/database';
import { createJobHandlerRegistry } from 'src/job-handler.registry';
import { createJobHandlers } from 'src/jobs/job-handler';
import { ConsoleLogger, type LogLevel } from 'src/logger';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { EnvConfigRepository } from 'src/repositories/env-config.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { LiveActivityRepository } from 'src/repositories/live-activity.repository';
import { McpPreferenceRepository } from 'src/repositories/mcp-preference.repository';
import { MediaRepository } from 'src/repositories/media.repository';
import { FileSystemStorageRepository } from 'src/repositories/node/filesystem-storage.repository';
import { NodeCryptoRepository } from 'src/repositories/node/node-crypto.repository';
import { PgBossJobRepository } from 'src/repositories/node/pgboss-job.repository';
import { PostgresRealtimeRepository } from 'src/repositories/node/postgres-realtime.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { SessionRepository } from 'src/repositories/session.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { TakeoutRepository } from 'src/repositories/takeout.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityImageService } from 'src/services/activity-image.service';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { ActivityService } from 'src/services/activity.service';
import { AuthService } from 'src/services/auth.service';
import type { BaseServiceDeps } from 'src/services/base.service';
import { JobService } from 'src/services/job.service';
import { LiveService } from 'src/services/live-activity.service';
import { ServerService } from 'src/services/server.service';
import { SocialService } from 'src/services/social.service';
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';
import { UserService } from 'src/services/user.service';

export type ApplicationRole = 'api' | 'worker';
type Class<T> = new (...args: never[]) => T;

export type CompositionOptions = {
  role: ApplicationRole;
  configRepository?: EnvConfigRepository;
  logLevels?: LogLevel[];
};

// Node composition owns the native and self-hosted repository implementations.
export const createApplicationComposition = ({
  role,
  configRepository = new EnvConfigRepository(),
  logLevels,
}: CompositionOptions) => {
  const consumeJobs = role === 'worker';
  const newLogger = (): ConsoleLogger => new ConsoleLogger({ logLevels });
  const database = createDatabase(configRepository.database);
  const activityRepository = new ActivityRepository(database);
  const mediaRepository = new MediaRepository(database);
  const authCredentialRepository = new SessionRepository(database);
  const cryptoRepository = new NodeCryptoRepository();
  const databaseRepository = new DatabaseRepository(database);
  const fitRepository = new FitRepository(newLogger());
  const gpxRepository = new GpxRepository(newLogger());
  const liveActivityRepository = new LiveActivityRepository(database);
  const rateLimitingRepository = new RateLimitingRepository(database);
  const socialRepository = new SocialRepository(database);
  const storageRepository = new FileSystemStorageRepository(configRepository, cryptoRepository);
  const tcxRepository = new TcxRepository(newLogger());
  const uploadRepository = new UploadRepository(database);
  const userRepository = new UserRepository(database);
  const eventRepository = new PostgresRealtimeRepository(
    database,
    configRepository,
    socialRepository,
    authCredentialRepository,
  );
  const jobRepository = new PgBossJobRepository(configRepository, consumeJobs, newLogger());

  const importProgressStore = new TakeoutRepository(database);

  const serviceDeps: BaseServiceDeps = {
    activityRepository,
    configRepository,
    cryptoRepository,
    databaseRepository,
    eventRepository,
    fitRepository,
    gpxRepository,
    jobRepository,
    liveActivityRepository,
    logger: newLogger(),
    mediaRepository,
    mcpPreferenceRepository: new McpPreferenceRepository(database),
    rateLimitingRepository,
    sessionRepository: authCredentialRepository,
    socialRepository,
    storageRepository,
    takeoutRepository: importProgressStore,
    tcxRepository,
    uploadRepository,
    userRepository,
  };

  const activityService = new ActivityService(serviceDeps);
  const activityQueryService = new ActivityQueryService(serviceDeps);
  const activityImageService = new ActivityImageService(serviceDeps);
  const authService = new AuthService(serviceDeps);
  const liveActivityService = new LiveService(serviceDeps);
  const serverService = new ServerService();
  const socialService = new SocialService(serviceDeps);
  const storageService = new StorageService(serviceDeps);
  const uploadService = new UploadService(serviceDeps);
  const userService = new UserService(serviceDeps);

  const jobService = new JobService(
    serviceDeps,
    createJobHandlers(
      createJobHandlerRegistry({
        activityService,
        activityImageService,
        authService,
        storageService,
        uploadService,
        userService,
      }),
    ),
  );

  const namedInstances = {
    role,
    consumeJobs,
    database,
    configRepository,
    activityRepository,
    mediaRepository,
    authCredentialRepository,
    cryptoRepository,
    databaseRepository,
    eventRepository,
    fitRepository,
    gpxRepository,
    jobRepository,
    liveActivityRepository,
    rateLimitingRepository,
    socialRepository,
    storageRepository,
    tcxRepository,
    uploadRepository,
    userRepository,
    importProgressStore,
    activityService,
    activityImageService,
    authService,
    jobService,
    activityQueryService,
    liveActivityService,
    serverService,
    socialService,
    storageService,
    uploadService,
    userService,
  };
  const instances = new Map<Class<unknown>, unknown>([
    [EnvConfigRepository, configRepository],
    [ActivityRepository, activityRepository],
    [MediaRepository, mediaRepository],
    [SessionRepository, authCredentialRepository],
    [NodeCryptoRepository, cryptoRepository],
    [DatabaseRepository, databaseRepository],
    [PostgresRealtimeRepository, eventRepository],
    [FitRepository, fitRepository],
    [GpxRepository, gpxRepository],
    [PgBossJobRepository, jobRepository],
    [LiveActivityRepository, liveActivityRepository],
    [RateLimitingRepository, rateLimitingRepository],
    [SocialRepository, socialRepository],
    [FileSystemStorageRepository, storageRepository],
    [TcxRepository, tcxRepository],
    [UploadRepository, uploadRepository],
    [UserRepository, userRepository],
    [TakeoutRepository, importProgressStore],
    [ActivityService, activityService],
    [ActivityImageService, activityImageService],
    [AuthService, authService],
    [JobService, jobService],
    [LiveService, liveActivityService],
    [ServerService, serverService],
    [SocialService, socialService],
    [StorageService, storageService],
    [UploadService, uploadService],
    [UserService, userService],
  ]);

  let initialization: Promise<void> | undefined;
  let shutdown: Promise<void> | undefined;

  return {
    ...namedInstances,
    get<T>(type: Class<T>): T {
      const instance = instances.get(type);
      if (!instance) {
        throw new Error(`No composed instance for ${type.name}`);
      }
      return instance as T;
    },
    initialize(): Promise<void> {
      initialization ??= consumeJobs
        ? jobRepository.startWorkers(jobService.execute.bind(jobService))
        : Promise.resolve();
      return initialization;
    },
    close(): Promise<void> {
      shutdown ??= (async () => {
        try {
          await jobRepository.stop();
        } finally {
          try {
            await eventRepository.stop();
          } finally {
            await database.destroy();
          }
        }
      })();
      return shutdown;
    },
  };
};

export type ApplicationComposition = ReturnType<typeof createApplicationComposition>;
