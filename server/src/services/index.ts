import { ActivityImageService } from 'src/services/activity-image.service';
import { ActivityService } from 'src/services/activity.service';
import { AuthService } from 'src/services/auth.service';
import { JobService } from 'src/services/job.service';
import { LiveWorkoutService } from 'src/services/live-workout.service';
import { ServerService } from 'src/services/server.service';
import { StorageService } from 'src/services/storage.service';
import { UploadService } from 'src/services/upload.service';

export const services = [
  ActivityService,
  ActivityImageService,
  JobService,
  LiveWorkoutService,
  ServerService,
  StorageService,
  UploadService,
  AuthService,
];
