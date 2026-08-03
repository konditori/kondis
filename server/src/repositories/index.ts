import { ActivityRepository } from 'src/repositories/activity.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';

export const repositories = [
  ActivityRepository,
  CryptoRepository,
  DatabaseRepository,
  FitRepository,
  JobRepository,
  StorageRepository,
  UploadRepository,
];
