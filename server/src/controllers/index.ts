import { ActivityController } from 'src/controllers/activity.controller';
import { UploadController } from 'src/controllers/upload.controller';
import { JobController } from 'src/controllers/job.controller';
import { ServerController } from 'src/controllers/server.controller';

export const controllers = [ServerController, UploadController, JobController, ActivityController];
