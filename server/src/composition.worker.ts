import { createHyperdriveDatabase } from 'src/db/hyperdrive';
import type { DemoLiveIngestionBinding, DemoLiveTrackerNamespaceBinding } from 'src/demo/live-durable-object';
import { createWorkerJobHandlers } from 'src/job-handler.registry.worker';
import { ConsoleLogger } from 'src/logger';
import { McpOAuthService } from 'src/mcp/oauth';
import { ActivityRepository } from 'src/repositories/activity.repository';
import {
  CloudflareQueueRepository,
  type CloudflareQueueBinding,
} from 'src/repositories/cloudflare/cloudflare-queue.repository';
import {
  DurableObjectRealtimeRepository,
  type DurableObjectNamespaceBinding,
} from 'src/repositories/cloudflare/durable-object-realtime.repository';
import { R2StorageRepository, type R2BucketBinding } from 'src/repositories/cloudflare/r2-storage.repository';
import { WorkerCryptoRepository } from 'src/repositories/cloudflare/worker-crypto.repository';
import { EnvConfigRepository } from 'src/repositories/env-config.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { LiveActivityRepository } from 'src/repositories/live-activity.repository';
import { McpCredentialRepository } from 'src/repositories/mcp-credential.repository';
import { McpOAuthRepository } from 'src/repositories/mcp-oauth.repository';
import { McpOperationRepository } from 'src/repositories/mcp-operation.repository';
import { McpPreferenceRepository } from 'src/repositories/mcp-preference.repository';
import { MediaRepository } from 'src/repositories/media.repository';
import { NoopRealtimeRepository } from 'src/repositories/noop-realtime.repository';
import { PostgresJobRepository } from 'src/repositories/postgres-job.repository';
import { PostgresTransactionRepository } from 'src/repositories/postgres-transaction.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { SessionRepository } from 'src/repositories/session.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { TakeoutRepository } from 'src/repositories/takeout.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { ActivityUploadService } from 'src/services/activity-upload.service';
import { ActivityService } from 'src/services/activity.service';
import { ApiKeyService } from 'src/services/api-key.service';
import { AuthService } from 'src/services/auth.service';
import type { BaseServiceDeps } from 'src/services/base.service';
import { JobService } from 'src/services/job.service';
import { LiveService } from 'src/services/live-activity.service';
import { McpPreferenceService } from 'src/services/mcp-preference.service';
import { OperationService } from 'src/services/operation.service';
import { PostgresJobService } from 'src/services/postgres-job.service';
import { SocialService } from 'src/services/social.service';
import { WorkerActivityImageService } from 'src/services/worker-activity-image.service';
import { WorkerUploadService } from 'src/services/worker-upload.service';
import { WorkerUserService } from 'src/services/worker-user.service';

const workerCrypto = new WorkerCryptoRepository();

export type WorkerBindings = {
  HYPERDRIVE: { connectionString: string };
  KONDIS_SETUP_TOKEN?: string;
  KONDIS_MCP_PUBLIC_URL?: string;
  KONDIS_REGISTRATION_ENABLED?: boolean | string;
  KONDIS_CLOUD_NODE_PROCESSOR_ENABLED?: boolean | string;
  KONDIS_DEMO_MODE?: boolean | string;
  KONDIS_DEMO_MEDIA_BASE_URL?: string;
  KONDIS_REALTIME_PUBLISH_TOKEN?: string;
  QUEUE_EXECUTOR?: { fetch: (request: Request) => Promise<Response> };
  STORAGE_BUCKET?: R2BucketBinding;
  REALTIME?: DurableObjectNamespaceBinding;
  DEMO_LIVE_TRACKER?: DemoLiveTrackerNamespaceBinding;
  DEMO_LIVE_INGESTION?: DemoLiveIngestionBinding;
  ACTIVITY_PARSING_QUEUE?: CloudflareQueueBinding;
  ACTIVITY_ENRICHMENT_QUEUE?: CloudflareQueueBinding;
  ACTIVITY_RANKING_QUEUE?: CloudflareQueueBinding;
  BACKGROUND_TASK_QUEUE?: CloudflareQueueBinding;
  IMAGE_PROCESSING_QUEUE?: CloudflareQueueBinding;
  STORAGE_QUEUE?: CloudflareQueueBinding;
};

export const createWorkerInvocationComposition = (env: WorkerBindings) => {
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error('HYPERDRIVE is required for this Worker invocation');
  }
  const { db: database, close } = createHyperdriveDatabase(env.HYPERDRIVE.connectionString);
  const transactions = new PostgresTransactionRepository(database);
  const jobRepository = new PostgresJobRepository(database);
  const storage = env.STORAGE_BUCKET ? new R2StorageRepository(env.STORAGE_BUCKET) : undefined;
  const mediaRepository = new MediaRepository(database);
  const workerEvents = env.REALTIME ? new DurableObjectRealtimeRepository(env.REALTIME) : new NoopRealtimeRepository();
  const authCredentialRepository = new SessionRepository(database);
  const userRepository = new UserRepository(database);
  const config = new EnvConfigRepository({
    KONDIS_DEMO_MODE: toConfigValue(env.KONDIS_DEMO_MODE),
    KONDIS_REGISTRATION_ENABLED: toConfigValue(env.KONDIS_REGISTRATION_ENABLED),
    KONDIS_SETUP_TOKEN: env.KONDIS_SETUP_TOKEN,
    KONDIS_TRUST_PROXY_HEADERS: 'true',
  });
  const cloudNodeProcessorEnabled =
    env.KONDIS_CLOUD_NODE_PROCESSOR_ENABLED === true || env.KONDIS_CLOUD_NODE_PROCESSOR_ENABLED === 'true';
  const queueBindingsConfigured = Boolean(
    env.ACTIVITY_PARSING_QUEUE &&
    env.ACTIVITY_ENRICHMENT_QUEUE &&
    env.ACTIVITY_RANKING_QUEUE &&
    env.BACKGROUND_TASK_QUEUE &&
    env.IMAGE_PROCESSING_QUEUE &&
    env.STORAGE_QUEUE,
  );
  const rateLimitingRepository = new RateLimitingRepository(database);
  const fitRepository = new FitRepository(new ConsoleLogger());
  const activityRepository = new ActivityRepository(database);
  const uploadRepository = new UploadRepository(database);
  const activityUploadService = new ActivityUploadService(uploadRepository, jobRepository);
  const mcpCredentialRepository = new McpCredentialRepository(database);
  const mcpOAuthRepository = new McpOAuthRepository(database);
  const mcpOperationRepository = new McpOperationRepository(database);
  const mcpPreferenceRepository = new McpPreferenceRepository(database);
  const socialRepository = new SocialRepository(database, env.KONDIS_DEMO_MEDIA_BASE_URL);
  const importProgressStore = new TakeoutRepository(database);

  const serviceDeps: BaseServiceDeps = {
    activityRepository,
    configRepository: config,
    cryptoRepository: workerCrypto,
    databaseRepository: transactions,
    eventRepository: workerEvents,
    fitRepository,
    gpxRepository: new GpxRepository(new ConsoleLogger()),
    jobRepository,
    liveActivityRepository: new LiveActivityRepository(database),
    logger: new ConsoleLogger(),
    mediaRepository,
    mcpPreferenceRepository,
    mediaBaseUrl: env.KONDIS_DEMO_MEDIA_BASE_URL,
    rateLimitingRepository,
    sessionRepository: authCredentialRepository,
    socialRepository,
    storageRepository: storage ?? ({} as never),
    takeoutRepository: importProgressStore,
    tcxRepository: new TcxRepository(new ConsoleLogger()),
    uploadRepository,
    userRepository,
  };

  const authService = new AuthService(serviceDeps, {
    deleteExpired: mcpOAuthRepository.deleteExpired.bind(mcpOAuthRepository),
    deleteExpiredUploads: mcpOperationRepository.deleteExpiredUploads.bind(mcpOperationRepository),
  });
  const activityService = new ActivityService(serviceDeps);
  const apiKeyService = new ApiKeyService(mcpCredentialRepository, transactions);
  const mcpOAuthService = new McpOAuthService(
    mcpOAuthRepository,
    mcpCredentialRepository,
    transactions,
    env.KONDIS_MCP_PUBLIC_URL ?? '',
  );
  const mcpOperationService = new OperationService(
    mcpOperationRepository,
    transactions,
    activityService,
    activityUploadService,
    storage,
  );
  const mcpPreferenceService = new McpPreferenceService(mcpPreferenceRepository);
  const activityQueryService = new ActivityQueryService(serviceDeps);
  const workerActivityImageService = storage ? new WorkerActivityImageService(serviceDeps) : undefined;
  const workerUploadService = storage ? new WorkerUploadService(serviceDeps, activityUploadService) : undefined;
  const workerUserService = storage ? new WorkerUserService(serviceDeps) : undefined;
  const socialService = new SocialService(serviceDeps);
  const liveActivityService = new LiveService(serviceDeps);
  const jobService = new JobService(
    serviceDeps,
    createWorkerJobHandlers({
      authService,
      activityService,
      uploadService: workerUploadService,
    }),
  );
  const postgresJobService = new PostgresJobService(jobRepository, jobService.execute.bind(jobService), {
    hasHandler: jobService.hasHandler.bind(jobService),
    publisher: new CloudflareQueueRepository({
      activityParsing: env.ACTIVITY_PARSING_QUEUE,
      activityEnrichment: env.ACTIVITY_ENRICHMENT_QUEUE,
      activityRanking: env.ACTIVITY_RANKING_QUEUE,
      backgroundTask: env.BACKGROUND_TASK_QUEUE,
      imageProcessing: env.IMAGE_PROCESSING_QUEUE,
      storage: env.STORAGE_QUEUE,
    }),
    realtime: workerEvents,
    takeout: importProgressStore,
  });

  return {
    close,
    database,
    rateLimitingRepository,
    authCredentialRepository,
    authService,
    apiKeyService,
    mcpOAuthService,
    mcpOperationService,
    mcpPreferenceService,
    activityService,
    activityUploadService,
    activityRepository,
    activityQueryService,
    uploadRepository,
    fitRepository,
    socialService,
    liveActivityService,
    jobService,
    postgresJobService,
    userRepository,
    config,
    cloudNodeProcessorEnabled,
    queueBindingsConfigured,
    realtimeEnabled: Boolean(env.REALTIME),
    realtime: workerEvents,
    storage,
    workerActivityImageService,
    workerUploadService,
    workerUserService,
    mediaRepository,
    demoMediaBaseUrl: env.KONDIS_DEMO_MEDIA_BASE_URL,
    jobAdmin: jobRepository,
    jobProducer: jobRepository,
  };
};

const toConfigValue = (value: boolean | string | undefined): string | undefined =>
  typeof value === 'boolean' ? String(value) : value;

export type WorkerInvocationComposition = ReturnType<typeof createWorkerInvocationComposition>;
