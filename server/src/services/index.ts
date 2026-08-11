import { ActivityService } from 'src/services/activity.service';
import { JobService } from 'src/services/job.service';
import { RealtimeService } from 'src/services/realtime.service';
import { ServerService } from 'src/services/server.service';
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';

export const services = [ActivityService, JobService, RealtimeService, ServerService, StorageService, UploadService];
