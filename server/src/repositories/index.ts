import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { LiveWorkoutRepository } from 'src/repositories/live-workout.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { SocialRepository } from 'src/repositories/social.repository';

export const repositories = [
  ActivityRepository,
  ActivityImageRepository,
  CryptoRepository,
  DatabaseRepository,
  EventRepository,
  FitRepository,
  GpxRepository,
  JobRepository,
  LiveWorkoutRepository,
  StorageRepository,
  TcxRepository,
  UploadRepository,
  UserRepository,
  SocialRepository,
];
