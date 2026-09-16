import type { ConfigRepository } from 'src/contracts/config.repository';
import type { CryptoRepository } from 'src/contracts/crypto.repository';
import type { JobRepository } from 'src/contracts/job.repository';
import type { RealtimeRepository } from 'src/contracts/realtime.repository';
import type { StorageRepository } from 'src/contracts/storage.repository';
import type { TransactionRepository } from 'src/contracts/transaction.repository';
import { ConsoleLogger } from 'src/logger';
import type { ActivityRepository } from 'src/repositories/activity.repository';
import type { FitRepository } from 'src/repositories/fit.repository';
import type { GpxRepository } from 'src/repositories/gpx.repository';
import type { LiveActivityRepository } from 'src/repositories/live-activity.repository';
import type { MediaRepository } from 'src/repositories/media.repository';
import type { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import type { SessionRepository } from 'src/repositories/session.repository';
import type { SocialRepository } from 'src/repositories/social.repository';
import type { TakeoutRepository } from 'src/repositories/takeout.repository';
import type { TcxRepository } from 'src/repositories/tcx.repository';
import type { UploadRepository } from 'src/repositories/upload.repository';
import type { UserRepository } from 'src/repositories/user.repository';

export type BaseServiceDeps = {
  activityRepository: ActivityRepository;
  configRepository: ConfigRepository;
  cryptoRepository: CryptoRepository;
  databaseRepository: TransactionRepository;
  eventRepository: RealtimeRepository;
  fitRepository: FitRepository;
  gpxRepository: GpxRepository;
  jobRepository: JobRepository;
  liveActivityRepository: LiveActivityRepository;
  logger: ConsoleLogger;
  mediaRepository: MediaRepository;
  mediaBaseUrl?: string;
  rateLimitingRepository: RateLimitingRepository;
  sessionRepository: SessionRepository;
  socialRepository: SocialRepository;
  storageRepository: StorageRepository;
  takeoutRepository: TakeoutRepository;
  tcxRepository: TcxRepository;
  uploadRepository: UploadRepository;
  userRepository: UserRepository;
};

export class BaseService {
  protected readonly activityRepository: ActivityRepository;
  protected readonly configRepository: ConfigRepository;
  protected readonly cryptoRepository: CryptoRepository;
  protected readonly databaseRepository: TransactionRepository;
  protected readonly eventRepository: RealtimeRepository;
  protected readonly fitRepository: FitRepository;
  protected readonly gpxRepository: GpxRepository;
  protected readonly jobRepository: JobRepository;
  protected readonly liveActivityRepository: LiveActivityRepository;
  protected readonly logger: ConsoleLogger;
  protected readonly mediaRepository: MediaRepository;
  protected readonly mediaBaseUrl?: string;
  protected readonly rateLimitingRepository: RateLimitingRepository;
  protected readonly sessionRepository: SessionRepository;
  protected readonly socialRepository: SocialRepository;
  protected readonly storageRepository: StorageRepository;
  protected readonly takeoutRepository: TakeoutRepository;
  protected readonly tcxRepository: TcxRepository;
  protected readonly uploadRepository: UploadRepository;
  protected readonly userRepository: UserRepository;

  constructor(deps: BaseServiceDeps) {
    this.activityRepository = deps.activityRepository;
    this.configRepository = deps.configRepository;
    this.cryptoRepository = deps.cryptoRepository;
    this.databaseRepository = deps.databaseRepository;
    this.eventRepository = deps.eventRepository;
    this.fitRepository = deps.fitRepository;
    this.gpxRepository = deps.gpxRepository;
    this.jobRepository = deps.jobRepository;
    this.liveActivityRepository = deps.liveActivityRepository;
    this.mediaRepository = deps.mediaRepository;
    this.mediaBaseUrl = deps.mediaBaseUrl;
    this.rateLimitingRepository = deps.rateLimitingRepository;
    this.sessionRepository = deps.sessionRepository;
    this.socialRepository = deps.socialRepository;
    this.storageRepository = deps.storageRepository;
    this.takeoutRepository = deps.takeoutRepository;
    this.tcxRepository = deps.tcxRepository;
    this.uploadRepository = deps.uploadRepository;
    this.userRepository = deps.userRepository;
    this.logger = deps.logger.withContext(this.constructor.name);
  }
}
