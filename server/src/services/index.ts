import { ActivityService } from 'src/services/activity.service';
import { JobService } from 'src/services/job.service';
import { ServerService } from 'src/services/server.service';
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';

/**
 * Every service, in one array.
 *
 * This is also the list `JobRepository.setup` scans for `@OnJob` handlers, so a service whose
 * handlers must run has to be registered here. Startup fails loudly if one is missing.
 */
export const services = [ActivityService, JobService, ServerService, StorageService, UploadService];
