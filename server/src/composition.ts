import { createDatabase } from 'src/db/database';
import { LagomTakeoutParser } from 'src/imports/lagom-takeout.parser';
import { createJobHandlerRegistry } from 'src/job-handler.registry';
import { ConsoleLogger, type LogLevel } from 'src/logger';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { ConfigRepository } from 'src/repositories/config.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { LiveWorkoutRepository } from 'src/repositories/live-workout.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityImageService } from 'src/services/activity-image.service';
import { ActivityService } from 'src/services/activity.service';
import { AuthService } from 'src/services/auth.service';
import { JobService } from 'src/services/job.service';
import { LiveWorkoutService } from 'src/services/live-workout.service';
import { ServerService } from 'src/services/server.service';
import { SocialService } from 'src/services/social.service';
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';
import { UserService } from 'src/services/user.service';
import { ImportProgressStore } from 'src/state/import-progress.store';

export type ApplicationRole = 'api' | 'worker';
type Class<T> = new (...args: never[]) => T;

export type CompositionOptions = {
  role: ApplicationRole;
  configRepository?: ConfigRepository;
  logLevels?: LogLevel[];
};

export const createApplicationComposition = ({
  role,
  configRepository = new ConfigRepository(),
  logLevels,
}: CompositionOptions) => {
  const consumeJobs = role === 'worker';
  const newLogger = (): ConsoleLogger => new ConsoleLogger({ logLevels });
  const database = createDatabase(configRepository.database);

  const activityRepository = new ActivityRepository(database);
  const activityImageRepository = new ActivityImageRepository(database);
  const cryptoRepository = new CryptoRepository();
  const databaseRepository = new DatabaseRepository(database);
  const fitRepository = new FitRepository(newLogger());
  const gpxRepository = new GpxRepository(newLogger());
  const liveWorkoutRepository = new LiveWorkoutRepository(database);
  const rateLimitingRepository = new RateLimitingRepository();
  const socialRepository = new SocialRepository(database);
  const storageRepository = new StorageRepository(configRepository, cryptoRepository);
  const tcxRepository = new TcxRepository(newLogger());
  const uploadRepository = new UploadRepository(database);
  const userRepository = new UserRepository(database);
  const eventRepository = new EventRepository(database, configRepository, socialRepository);
  const jobRepository = new JobRepository(configRepository, consumeJobs, newLogger());

  const importProgressStore = new ImportProgressStore(database);
  const lagomTakeoutParser = new LagomTakeoutParser();

  const activityService = new ActivityService(
    uploadRepository,
    storageRepository,
    activityRepository,
    databaseRepository,
    eventRepository,
    jobRepository,
    fitRepository,
    gpxRepository,
    tcxRepository,
    newLogger(),
    importProgressStore,
    activityImageRepository,
    socialRepository,
  );
  const activityImageService = new ActivityImageService(
    activityImageRepository,
    activityRepository,
    storageRepository,
    cryptoRepository,
    databaseRepository,
    jobRepository,
    newLogger(),
    socialRepository,
  );
  const authService = new AuthService(userRepository, configRepository, rateLimitingRepository, cryptoRepository);
  const jobService = new JobService(jobRepository, eventRepository, newLogger());
  const liveWorkoutService = new LiveWorkoutService(liveWorkoutRepository, cryptoRepository);
  const serverService = new ServerService();
  const socialService = new SocialService(socialRepository, database, eventRepository);
  const storageService = new StorageService(storageRepository, jobRepository, newLogger());
  const uploadService = new UploadService(
    uploadRepository,
    storageRepository,
    cryptoRepository,
    databaseRepository,
    jobRepository,
    newLogger(),
    lagomTakeoutParser,
    importProgressStore,
    userRepository,
    activityRepository,
    eventRepository,
  );
  const userService = new UserService(userRepository, socialRepository, storageRepository);

  jobRepository.setup(
    createJobHandlerRegistry({
      activityService,
      activityImageService,
      storageService,
      uploadService,
      userService,
    }),
  );

  const namedInstances = {
    role,
    consumeJobs,
    database,
    configRepository,
    activityRepository,
    activityImageRepository,
    cryptoRepository,
    databaseRepository,
    eventRepository,
    fitRepository,
    gpxRepository,
    jobRepository,
    liveWorkoutRepository,
    rateLimitingRepository,
    socialRepository,
    storageRepository,
    tcxRepository,
    uploadRepository,
    userRepository,
    importProgressStore,
    lagomTakeoutParser,
    activityService,
    activityImageService,
    authService,
    jobService,
    liveWorkoutService,
    serverService,
    socialService,
    storageService,
    uploadService,
    userService,
  };
  const instances = new Map<Class<unknown>, unknown>([
    [ConfigRepository, configRepository],
    [ActivityRepository, activityRepository],
    [ActivityImageRepository, activityImageRepository],
    [CryptoRepository, cryptoRepository],
    [DatabaseRepository, databaseRepository],
    [EventRepository, eventRepository],
    [FitRepository, fitRepository],
    [GpxRepository, gpxRepository],
    [JobRepository, jobRepository],
    [LiveWorkoutRepository, liveWorkoutRepository],
    [RateLimitingRepository, rateLimitingRepository],
    [SocialRepository, socialRepository],
    [StorageRepository, storageRepository],
    [TcxRepository, tcxRepository],
    [UploadRepository, uploadRepository],
    [UserRepository, userRepository],
    [ImportProgressStore, importProgressStore],
    [LagomTakeoutParser, lagomTakeoutParser],
    [ActivityService, activityService],
    [ActivityImageService, activityImageService],
    [AuthService, authService],
    [JobService, jobService],
    [LiveWorkoutService, liveWorkoutService],
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
      initialization ??= jobService.init(consumeJobs);
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
