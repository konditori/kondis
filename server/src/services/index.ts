import { ActivityService } from 'src/services/activity.service';
import { JobService } from 'src/services/job.service';
import { LagomService } from 'src/services/lagom.service';
import { ServerService } from 'src/services/server.service';
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';

export const services = [ActivityService, JobService, LagomService, ServerService, StorageService, UploadService];
