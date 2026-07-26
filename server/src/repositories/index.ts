import { ActivityRepository } from 'src/repositories/activity.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';

export const repositories = [ActivityRepository, StorageRepository, UploadRepository];
