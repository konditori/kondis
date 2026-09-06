import { CloudflareQueueAdapter } from 'src/adapters/cloudflare/queue.adapter';
import { createDatabase } from 'src/db/database';
import { LagomTakeoutParser } from 'src/imports/lagom-takeout.parser';
import { createJobHandlerRegistry } from 'src/job-handler.registry';
import { createPollingJobHandlers, PollingJobConsumer } from 'src/jobs/polling-job.consumer';
import { ConsoleLogger, type LogLevel } from 'src/logger';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { AuthCredentialRepository } from 'src/repositories/auth-credential.repository';
import { ConfigRepository } from 'src/repositories/config.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
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
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';
import { UserService } from 'src/services/user.service';
import { ImportProgressStore } from 'src/state/import-progress.store';

export type CloudNodeProcessorOptions = {
  configRepository?: ConfigRepository;
  logLevels?: LogLevel[];
};

export const createCloudNodeProcessorComposition = ({
  configRepository = new ConfigRepository(),
  logLevels,
}: CloudNodeProcessorOptions = {}) => {
  const logger = new ConsoleLogger({ logLevels });
  const database = createDatabase(configRepository.database);
  const queueAdapter = new CloudflareQueueAdapter(database);
  const cryptoRepository = new CryptoRepository();
  const activityRepository = new ActivityRepository(database);
  const activityImageRepository = new ActivityImageRepository(database);
  const authCredentialRepository = new AuthCredentialRepository(database);
  const databaseRepository = new DatabaseRepository(database);
  const fitRepository = new FitRepository(logger);
  const gpxRepository = new GpxRepository(logger);
  const rateLimitingRepository = new RateLimitingRepository(database);
  const socialRepository = new SocialRepository(database);
  const storageRepository = new StorageRepository(configRepository, cryptoRepository);
  const tcxRepository = new TcxRepository(logger);
  const uploadRepository = new UploadRepository(database);
  const userRepository = new UserRepository(database);
  const eventRepository = new EventRepository(database, configRepository, socialRepository, authCredentialRepository);
  const importProgressStore = new ImportProgressStore(database);
  const lagomTakeoutParser = new LagomTakeoutParser();

  const activityService = new ActivityService(
    uploadRepository,
    storageRepository,
    activityRepository,
    databaseRepository,
    eventRepository,
    queueAdapter,
    fitRepository,
    gpxRepository,
    tcxRepository,
    logger,
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
    queueAdapter,
    logger,
    socialRepository,
  );
  const authService = new AuthService(
    userRepository,
    configRepository,
    rateLimitingRepository,
    cryptoRepository,
    authCredentialRepository,
    eventRepository,
    databaseRepository,
  );
  const storageService = new StorageService(storageRepository, queueAdapter, logger);
  const uploadService = new UploadService(
    uploadRepository,
    storageRepository,
    cryptoRepository,
    databaseRepository,
    queueAdapter,
    logger,
    lagomTakeoutParser,
    importProgressStore,
    userRepository,
    activityRepository,
    eventRepository,
  );
  const userService = new UserService(userRepository, socialRepository, storageRepository);
  const descriptors = createJobHandlerRegistry({
    activityService,
    activityImageService,
    authService,
    storageService,
    uploadService,
    userService,
  });
  const pollingConsumer = new PollingJobConsumer(database, createPollingJobHandlers(descriptors), {
    logger,
  });
  const jobService = new JobService(
    { admin: queueAdapter, consumer: pollingConsumer, producer: queueAdapter },
    eventRepository,
    logger,
  );
  let closePromise: Promise<void> | undefined;

  return {
    database,
    jobService,
    initialize: () => jobService.init(true),
    close: () => {
      closePromise ??= (async () => {
        try {
          await pollingConsumer.stop();
        } finally {
          try {
            await eventRepository.stop();
          } finally {
            await database.destroy();
          }
        }
      })();
      return closePromise;
    },
  };
};

export type CloudNodeProcessorComposition = ReturnType<typeof createCloudNodeProcessorComposition>;
