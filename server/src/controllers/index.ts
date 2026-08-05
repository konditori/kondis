import { ActivityController } from 'src/controllers/activity.controller';
import { ImportController } from 'src/controllers/import.controller';
import { JobController } from 'src/controllers/job.controller';
import { ServerController } from 'src/controllers/server.controller';

export const controllers = [ServerController, ImportController, JobController, ActivityController];
