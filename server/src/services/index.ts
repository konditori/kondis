import { ActivityService } from 'src/services/activity.service';
import { JobService } from 'src/services/job.service';
import { ServerService } from 'src/services/server.service';
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';
import { AuthService } from 'src/services/auth.service';

export const services = [ActivityService, JobService, ServerService, StorageService, UploadService, AuthService];
