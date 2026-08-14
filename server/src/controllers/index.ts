import { ActivityController } from 'src/controllers/activity.controller';
import { AuthController } from 'src/controllers/auth.controller';
import { JobController } from 'src/controllers/job.controller';
import { ServerController } from 'src/controllers/server.controller';
import { UploadController } from 'src/controllers/upload.controller';
import { UserController } from 'src/controllers/user.controller';

export const controllers = [
  ServerController,
  UploadController,
  JobController,
  ActivityController,
  AuthController,
  UserController,
];
