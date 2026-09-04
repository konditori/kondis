import { ActivityImageController } from 'src/controllers/activity-image.controller';
import { ActivityController } from 'src/controllers/activity.controller';
import { AuthController } from 'src/controllers/auth.controller';
import { JobController } from 'src/controllers/job.controller';
import { LiveWorkoutController } from 'src/controllers/live-workout.controller';
import { SocialController } from 'src/controllers/social.controller';
import { UploadController } from 'src/controllers/upload.controller';
import { UserController } from 'src/controllers/user.controller';

export const controllers = [
  UploadController,
  JobController,
  LiveWorkoutController,
  ActivityController,
  ActivityImageController,
  AuthController,
  UserController,
  SocialController,
];
