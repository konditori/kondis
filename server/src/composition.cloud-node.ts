import type { RealtimeRepository } from 'src/contracts/realtime.repository';
import { createDatabase } from 'src/db/database';
import { createJobHandlerRegistry } from 'src/job-handler.registry';
import { createJobHandlers } from 'src/jobs/job-handler';
import { ConsoleLogger, type LogLevel } from 'src/logger';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { EnvConfigRepository } from 'src/repositories/env-config.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { HttpRealtimeRepository } from 'src/repositories/http-realtime.repository';
import { LiveActivityRepository } from 'src/repositories/live-activity.repository';
import { MediaRepository } from 'src/repositories/media.repository';
import { FileSystemStorageRepository } from 'src/repositories/node/filesystem-storage.repository';
import { NodeCryptoRepository } from 'src/repositories/node/node-crypto.repository';
import { PostgresRealtimeRepository } from 'src/repositories/node/postgres-realtime.repository';
import { PostgresJobRepository } from 'src/repositories/postgres-job.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { SessionRepository } from 'src/repositories/session.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { TakeoutRepository } from 'src/repositories/takeout.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityImageService } from 'src/services/activity-image.service';
import { ActivityService } from 'src/services/activity.service';
import { AuthService } from 'src/services/auth.service';
import type { BaseServiceDeps } from 'src/services/base.service';
import { JobService } from 'src/services/job.service';
import { PostgresJobService } from 'src/services/postgres-job.service';
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';
import { UserService } from 'src/services/user.service';

export type CloudNodeProcessorOptions = {
  configRepository?: EnvConfigRepository;
  logLevels?: LogLevel[];
  realtime?: RealtimeRepository;
};

export const createCloudNodeProcessorComposition = ({
  configRepository = new EnvConfigRepository(),
  logLevels,
  realtime,
}: CloudNodeProcessorOptions = {}) => {
  const logger = new ConsoleLogger({ logLevels });
  const database = createDatabase(configRepository.database);
  const jobRepository = new PostgresJobRepository(database);
  const cryptoRepository = new NodeCryptoRepository();
  const activityRepository = new ActivityRepository(database);
  const mediaRepository = new MediaRepository(database);
  const sessionRepository = new SessionRepository(database);
  const databaseRepository = new DatabaseRepository(database);
  const fitRepository = new FitRepository(logger);
  const gpxRepository = new GpxRepository(logger);
  const rateLimitingRepository = new RateLimitingRepository(database);
  const socialRepository = new SocialRepository(database);
  const storageRepository = new FileSystemStorageRepository(configRepository, cryptoRepository);
  const tcxRepository = new TcxRepository(logger);
  const uploadRepository = new UploadRepository(database);
  const userRepository = new UserRepository(database);
  const eventRepository =
    realtime ?? createCloudNodeRealtimePublisher(database, configRepository, socialRepository, sessionRepository);
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
    liveActivityRepository: new LiveActivityRepository(database),
    logger,
    mediaRepository,
    rateLimitingRepository,
    sessionRepository,
    socialRepository,
    storageRepository,
    takeoutRepository: importProgressStore,
    tcxRepository,
    uploadRepository,
    userRepository,
  };

  const activityService = new ActivityService(serviceDeps);
  const activityImageService = new ActivityImageService(serviceDeps);
  const authService = new AuthService(serviceDeps);
  const storageService = new StorageService(serviceDeps);
  const uploadService = new UploadService(serviceDeps);
  const userService = new UserService(serviceDeps);
  const descriptors = createJobHandlerRegistry({
    activityService,
    activityImageService,
    authService,
    storageService,
    uploadService,
    userService,
  });
  const consumers = configRepository.demoMode ? (['node', 'worker'] as const) : (['node'] as const);
  const jobService = new JobService(serviceDeps, createJobHandlers(descriptors, consumers));
  const postgresJobService = new PostgresJobService(jobRepository, jobService.execute.bind(jobService), {
    hasHandler: jobService.hasHandler.bind(jobService),
    consumers,
    logger,
    realtime: eventRepository,
    takeout: importProgressStore,
  });
  let closePromise: Promise<void> | undefined;

  return {
    database,
    jobService,
    realtime: eventRepository,
    postgresJobService,
    initialize: () => postgresJobService.start(),
    drainJobs: (...queues: Parameters<PostgresJobService['drain']>) => postgresJobService.drain(...queues),
    close: () => {
      closePromise ??= (async () => {
        try {
          await postgresJobService.stop();
        } finally {
          try {
            await (eventRepository instanceof PostgresRealtimeRepository ? eventRepository.stop() : undefined);
          } finally {
            await database.destroy();
          }
        }
      })();
      return closePromise;
    },
  };
};

const createCloudNodeRealtimePublisher = (
  database: ReturnType<typeof createDatabase>,
  config: EnvConfigRepository,
  social: SocialRepository,
  credentials: SessionRepository,
): RealtimeRepository => {
  const url = process.env.KONDIS_REALTIME_PUBLISH_URL;
  const token = process.env.KONDIS_REALTIME_PUBLISH_TOKEN;
  return url && token
    ? new HttpRealtimeRepository(url, token)
    : new PostgresRealtimeRepository(database, config, social, credentials);
};

export type CloudNodeProcessorComposition = ReturnType<typeof createCloudNodeProcessorComposition>;
