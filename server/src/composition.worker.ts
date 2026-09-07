import { createCloudflareCryptoAdapter } from 'src/adapters/cloudflare/crypto.adapter';
import type { CloudflareQueueBinding } from 'src/adapters/cloudflare/queue-transport.adapter';
import { CloudflareQueueAdapter } from 'src/adapters/cloudflare/queue.adapter';
import { R2StorageAdapter, type R2BucketBinding } from 'src/adapters/cloudflare/storage.adapter';
import { createPortableWorkerHandlers } from 'src/cloudflare/queue-handler';
import {
  DurableObjectRealtimeAdapter,
  noopRealtime,
  type DurableObjectNamespaceBinding,
} from 'src/cloudflare/realtime-durable-object';
import { createHyperdriveDatabase } from 'src/db/hyperdrive';
import { ConsoleLogger } from 'src/logger';
import type { TransactionPort } from 'src/ports/transaction.port';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { AuthCredentialRepository } from 'src/repositories/auth-credential.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { LiveWorkoutRepository } from 'src/repositories/live-workout.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityService } from 'src/services/activity.service';
import { AuthService } from 'src/services/auth.service';
import { JobService } from 'src/services/job.service';
import { LiveWorkoutService } from 'src/services/live-workout.service';
import { SocialService } from 'src/services/social.service';
import { WorkerActivityImageService } from 'src/services/worker-activity-image.service';
import { WorkerUploadService } from 'src/services/worker-upload.service';
import { WorkerUserService } from 'src/services/worker-user.service';
import { ImportProgressStore } from 'src/state/import-progress.store';

const workerCrypto = createCloudflareCryptoAdapter();

export type WorkerBindings = {
  HYPERDRIVE: { connectionString: string };
  HYPERDRIVE_SPIKE_TOKEN?: string;
  KONDIS_SETUP_TOKEN?: string;
  KONDIS_REGISTRATION_ENABLED?: boolean | string;
  KONDIS_CLOUD_NODE_PROCESSOR_ENABLED?: boolean | string;
  KONDIS_AUTH_CREDENTIAL_CLEANUP_TOKEN?: string;
  KONDIS_REALTIME_PUBLISH_TOKEN?: string;
  KONDIS_QUERY_TIMING_ENABLED?: string;
  QUEUE_EXECUTOR?: { fetch: (request: Request) => Promise<Response> };
  STORAGE_BUCKET?: R2BucketBinding;
  REALTIME?: DurableObjectNamespaceBinding;
  ACTIVITY_PARSING_QUEUE?: CloudflareQueueBinding;
  ACTIVITY_ENRICHMENT_QUEUE?: CloudflareQueueBinding;
  BACKGROUND_TASK_QUEUE?: CloudflareQueueBinding;
  IMAGE_PROCESSING_QUEUE?: CloudflareQueueBinding;
  STORAGE_QUEUE?: CloudflareQueueBinding;
};

export const createWorkerInvocationComposition = (env: WorkerBindings) => {
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error('HYPERDRIVE is required for this Worker invocation');
  }
  const { db: database, close } = createHyperdriveDatabase(
    env.HYPERDRIVE.connectionString,
    env.KONDIS_QUERY_TIMING_ENABLED === 'true',
  );
  const transactions: TransactionPort = {
    withTransaction: (fn) => database.transaction().execute(fn),
  };
  const queueAdapter = new CloudflareQueueAdapter(database);
  const storage = env.STORAGE_BUCKET ? new R2StorageAdapter(env.STORAGE_BUCKET) : undefined;
  const workerEvents = env.REALTIME ? new DurableObjectRealtimeAdapter(env.REALTIME) : noopRealtime;
  const authCredentialRepository = new AuthCredentialRepository(database);
  const userRepository = new UserRepository(database);
  const config = {
    registrationEnabled: env.KONDIS_REGISTRATION_ENABLED === true || env.KONDIS_REGISTRATION_ENABLED === 'true',
    setupToken: env.KONDIS_SETUP_TOKEN,
    trustProxyHeaders: true,
  };
  const cloudNodeProcessorEnabled =
    env.KONDIS_CLOUD_NODE_PROCESSOR_ENABLED === true || env.KONDIS_CLOUD_NODE_PROCESSOR_ENABLED === 'true';
  const queueBindingsConfigured = Boolean(
    env.ACTIVITY_PARSING_QUEUE &&
    env.ACTIVITY_ENRICHMENT_QUEUE &&
    env.BACKGROUND_TASK_QUEUE &&
    env.IMAGE_PROCESSING_QUEUE &&
    env.STORAGE_QUEUE,
  );
  const rateLimitingRepository = new RateLimitingRepository(database);
  const authService = new AuthService(
    userRepository,
    config,
    rateLimitingRepository,
    workerCrypto,
    authCredentialRepository,
    workerEvents,
    transactions,
  );
  const activityRepository = new ActivityRepository(database);
  const uploadRepository = new UploadRepository(database);
  const socialRepository = new SocialRepository(database);
  const importProgressStore = new ImportProgressStore(database);
  const activityService = new ActivityService(
    uploadRepository,
    storage ?? ({} as never),
    activityRepository,
    transactions,
    workerEvents,
    queueAdapter,
    new FitRepository(new ConsoleLogger()),
    new GpxRepository(new ConsoleLogger()),
    new TcxRepository(new ConsoleLogger()),
    new ConsoleLogger(),
    importProgressStore,
    undefined,
    socialRepository,
  );
  const workerActivityImageService = storage
    ? new WorkerActivityImageService(
        new ActivityImageRepository(database),
        activityRepository,
        storage,
        workerCrypto,
        transactions,
        queueAdapter,
        socialRepository,
      )
    : undefined;
  const workerUploadService = storage
    ? new WorkerUploadService(
        storage,
        workerCrypto,
        queueAdapter,
        importProgressStore,
        uploadRepository,
        activityRepository,
        transactions,
        workerEvents,
      )
    : undefined;
  const workerUserService = storage
    ? new WorkerUserService(userRepository, socialRepository, storage, queueAdapter)
    : undefined;
  const socialService = new SocialService(socialRepository, database, workerEvents);
  const liveWorkoutService = new LiveWorkoutService(new LiveWorkoutRepository(database), workerCrypto);
  const jobService = new JobService({ admin: queueAdapter, producer: queueAdapter }, workerEvents, new ConsoleLogger());

  return {
    close,
    database,
    authCredentialRepository,
    authService,
    activityService,
    socialService,
    liveWorkoutService,
    jobService,
    userRepository,
    config,
    cloudNodeProcessorEnabled,
    queueBindingsConfigured,
    realtimeEnabled: Boolean(env.REALTIME),
    realtime: workerEvents,
    authCredentialCleanupToken: env.KONDIS_AUTH_CREDENTIAL_CLEANUP_TOKEN,
    storage,
    workerActivityImageService,
    workerUploadService,
    workerUserService,
    jobAdmin: queueAdapter,
    jobHandlers: createPortableWorkerHandlers(database, { activityService, uploadService: workerUploadService }),
    jobProducer: queueAdapter,
  };
};

export type WorkerInvocationComposition = ReturnType<typeof createWorkerInvocationComposition>;
