import type { CloudflareQueueBinding } from 'src/adapters/cloudflare/queue-transport.adapter';
import { CloudflareQueueAdapter } from 'src/adapters/cloudflare/queue.adapter';
import { createPortableWorkerHandlers } from 'src/cloudflare/queue-handler';
import { createHyperdriveDatabase } from 'src/db/hyperdrive';
import { ConsoleLogger } from 'src/logger';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { AuthCredentialRepository } from 'src/repositories/auth-credential.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { LiveWorkoutRepository } from 'src/repositories/live-workout.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityService } from 'src/services/activity.service';
import { JobService } from 'src/services/job.service';
import { LiveWorkoutService } from 'src/services/live-workout.service';
import { SocialService } from 'src/services/social.service';

const workerEvents = { emit: async () => {} };
const workerCrypto = {
  comparePassword: () => Promise.reject(new Error('Password authentication is not available in this Worker phase')),
  hashPassword: () => Promise.reject(new Error('Password authentication is not available in this Worker phase')),
  randomToken: (byteLength: number) => {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    return btoa(String.fromCodePoint(...bytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  },
  safeEqual: (left: string, right: string) => left === right,
  sha256: async (value: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    const bytes = new Uint8Array(digest);
    return btoa(String.fromCodePoint(...bytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  },
  uuid: () => crypto.randomUUID(),
  xxHash: (contents: Uint8Array) => Array.from(contents, (byte) => byte.toString(16).padStart(2, '0')).join(''),
};

export type WorkerBindings = {
  HYPERDRIVE: { connectionString: string };
  HYPERDRIVE_SPIKE_TOKEN?: string;
  ACTIVITY_PARSING_QUEUE?: CloudflareQueueBinding;
  BACKGROUND_TASK_QUEUE?: CloudflareQueueBinding;
  IMAGE_PROCESSING_QUEUE?: CloudflareQueueBinding;
  STORAGE_QUEUE?: CloudflareQueueBinding;
};

/**
 * Worker invocations must not retain database clients across requests. This
 * composition owns exactly one invocation-scoped client and its adapters.
 */
export const createWorkerInvocationComposition = (env: WorkerBindings) => {
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error('HYPERDRIVE is required for this Worker invocation');
  }
  const { db: database, close } = createHyperdriveDatabase(env.HYPERDRIVE.connectionString);
  const queueAdapter = new CloudflareQueueAdapter(database);
  const authCredentialRepository = new AuthCredentialRepository(database);
  const userRepository = new UserRepository(database);
  const activityRepository = new ActivityRepository(database);
  const socialRepository = new SocialRepository(database);
  const activityService = new ActivityService(
    new UploadRepository(database),
    {} as never,
    activityRepository,
    { withTransaction: (fn: never) => database.transaction().execute(fn) } as never,
    workerEvents,
    queueAdapter,
    new FitRepository(new ConsoleLogger()),
    new GpxRepository(new ConsoleLogger()),
    new TcxRepository(new ConsoleLogger()),
    new ConsoleLogger(),
    undefined,
    undefined,
    socialRepository,
  );
  const socialService = new SocialService(socialRepository, database, workerEvents);
  const liveWorkoutService = new LiveWorkoutService(new LiveWorkoutRepository(database), workerCrypto);
  const jobService = new JobService({ admin: queueAdapter, producer: queueAdapter }, workerEvents, new ConsoleLogger());

  return {
    close,
    database,
    authCredentialRepository,
    activityService,
    socialService,
    liveWorkoutService,
    jobService,
    userRepository,
    config: { registrationEnabled: false, trustProxyHeaders: true },
    jobAdmin: queueAdapter,
    jobHandlers: createPortableWorkerHandlers(database),
    jobProducer: queueAdapter,
  };
};

export type WorkerInvocationComposition = ReturnType<typeof createWorkerInvocationComposition>;
