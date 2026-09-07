import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { JobName, JobStatus } from 'src/enum';
import type { CryptoPort } from 'src/ports/crypto.port';
import type { JobProducerPort } from 'src/ports/queue.port';
import type { RealtimePort } from 'src/ports/realtime.port';
import type { StoragePort } from 'src/ports/storage.port';
import type { TransactionPort } from 'src/ports/transaction.port';
import type { ActivityRepository } from 'src/repositories/activity.repository';
import type { UploadRepository } from 'src/repositories/upload.repository';
import { WorkerUploadService } from 'src/services/worker-upload.service';
import type { ImportProgressStore } from 'src/state/import-progress.store';
import type { KondisTransaction } from 'src/types';
import type { JobOf } from 'src/types/jobs';

describe(WorkerUploadService.name, () => {
  const checksum = 'a'.repeat(64);
  const userId = '00000000-0000-4000-8000-000000000001';
  const transaction = {} as KondisTransaction;
  const contents = Buffer.from('activity file');
  const baseJob: JobOf<JobName.ActivityUpload> = {
    userId,
    originalName: 'morning-run.fit',
    storagePath: 'temporary/activity.fit',
    checksum,
  };

  const readLimited = vi.fn(() => Promise.resolve(contents));
  const buildPath = vi.fn(() => '00/00/permanent.fit');
  const write = vi.fn(() => Promise.resolve());
  const deleteFile = vi.fn(() => Promise.resolve());
  const sha256 = vi.fn(() => Promise.resolve(checksum));
  const queue = vi.fn(() => Promise.resolve());
  const getByChecksum = vi.fn();
  const create = vi.fn(() => Promise.resolve({ id: 'upload-id' }));
  const getByUploadId = vi.fn();
  const withTransaction = vi.fn(async (fn: (trx: KondisTransaction) => Promise<unknown>) => fn(transaction));
  const emit = vi.fn(() => Promise.resolve());
  const completeItem = vi.fn(() => Promise.resolve());

  const setup = () =>
    new WorkerUploadService(
      { readLimited, buildPath, write, delete: deleteFile } as unknown as StoragePort,
      { sha256 } as unknown as CryptoPort,
      { queue } as unknown as JobProducerPort,
      { completeItem } as unknown as ImportProgressStore,
      { getByChecksum, create } as unknown as UploadRepository,
      { getByUploadId } as unknown as ActivityRepository,
      { withTransaction } as TransactionPort,
      { emit } as RealtimePort,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    readLimited.mockResolvedValue(contents);
    sha256.mockResolvedValue(checksum);
    getByChecksum.mockResolvedValue(undefined);
    getByUploadId.mockResolvedValue(undefined);
  });

  it('rejects jobs without an owner before reading storage', async () => {
    const service = setup();

    await expect(service.handleActivityUpload({ ...baseJob, userId: undefined })).rejects.toThrow(
      'Activity upload job has no owner',
    );
    expect(readLimited).not.toHaveBeenCalled();
  });

  it('rejects unsupported extensions before reading storage', async () => {
    const service = setup();

    await expect(service.handleActivityUpload({ ...baseJob, originalName: 'activity.csv' })).rejects.toThrow(
      'Unsupported activity upload extension: .csv',
    );
    expect(readLimited).not.toHaveBeenCalled();
  });

  it('rejects a supplied checksum that does not match the staged object', async () => {
    const service = setup();

    await expect(service.handleActivityUpload({ ...baseJob, checksum: 'b'.repeat(64) })).rejects.toThrow(
      `Activity upload checksum mismatch: expected ${'b'.repeat(64)}, got ${checksum}`,
    );
    expect(readLimited).toHaveBeenCalledWith(baseJob.storagePath, UPLOAD_LIMITS.activityFileBytes);
    expect(getByChecksum).toHaveBeenCalledWith('b'.repeat(64), userId);
    expect(write).not.toHaveBeenCalled();
  });

  it('writes the already-read object and transactionally creates and queues an upload with activity metadata', async () => {
    const service = setup();
    const images = [
      {
        originalName: 'photo.jpg',
        storagePath: 'temporary/photo.jpg',
        checksum: 'c'.repeat(64),
        caption: 'Finish line',
        sortOrder: 0,
      },
    ];
    const job: JobOf<JobName.ActivityUpload> = {
      ...baseJob,
      checksum: undefined,
      activityName: 'Morning run',
      activityDescription: 'Easy miles',
      activitySport: 'run',
      activityTags: ['commute'],
      takeoutImportId: 'import-id',
      images,
    };

    await expect(service.handleActivityUpload(job)).resolves.toBe(JobStatus.Success);

    expect(getByChecksum).toHaveBeenCalledWith(checksum, userId);
    expect(buildPath).toHaveBeenCalledWith(userId, checksum, '.fit');
    expect(write).toHaveBeenCalledWith('00/00/permanent.fit', contents);
    expect(withTransaction).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(
      {
        checksum,
        original_name: baseJob.originalName,
        byte_size: contents.length,
        storage_path: '00/00/permanent.fit',
        user_id: userId,
      },
      transaction,
    );
    expect(queue).toHaveBeenCalledWith(
      {
        name: JobName.ActivityParse,
        data: {
          id: 'upload-id',
          images,
          takeoutImportId: 'import-id',
          activityName: 'Morning run',
          activityDescription: 'Easy miles',
          activitySport: 'run',
          activityTags: ['commute'],
        },
      },
      { transaction },
    );
    expect(deleteFile).toHaveBeenCalledWith(baseJob.storagePath);
  });

  it('skips an existing upload and reports its parsed activity while preserving images and progress', async () => {
    const service = setup();
    const images = [
      {
        originalName: 'photo.jpg',
        storagePath: 'temporary/photo.jpg',
        checksum: 'c'.repeat(64),
        sortOrder: 0,
      },
    ];
    getByChecksum.mockResolvedValue({ id: 'existing-upload' });
    getByUploadId.mockResolvedValue({ id: 'activity-id', name: 'Morning run', sport: 'run' });

    await expect(
      service.handleActivityUpload({
        ...baseJob,
        activityTags: ['commute'],
        images,
        takeoutImportId: 'import-id',
        takeoutItemKey: 'activity:morning-run.fit',
      }),
    ).resolves.toBe(JobStatus.Skipped);

    expect(getByChecksum).toHaveBeenCalledWith(checksum, userId);
    expect(emit).toHaveBeenCalledWith(
      'ActivityUploadSkipped',
      { id: 'activity-id', name: 'Morning run', sport: 'run' },
      baseJob.originalName,
    );
    expect(queue).toHaveBeenCalledWith({
      name: JobName.ActivityParse,
      data: {
        id: 'existing-upload',
        images,
        takeoutImportId: 'import-id',
        takeoutItemKey: 'activity:morning-run.fit',
        activityTags: ['commute'],
      },
    });
    expect(completeItem).toHaveBeenCalledWith('import-id', 'activity:morning-run.fit', 'duplicate');
    expect(write).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalledWith(baseJob.storagePath);
  });

  it('treats a concurrent insert as a duplicate and advances takeout progress', async () => {
    const service = setup();
    const insertError = new Error('unique violation');
    getByChecksum.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'raced-upload' });
    withTransaction.mockRejectedValueOnce(insertError);

    await expect(
      service.handleActivityUpload({
        ...baseJob,
        takeoutImportId: 'import-id',
        takeoutItemKey: 'activity:morning-run.fit',
      }),
    ).resolves.toBe(JobStatus.Skipped);
    expect(getByChecksum).toHaveBeenCalledTimes(2);
    expect(completeItem).toHaveBeenCalledWith('import-id', 'activity:morning-run.fit', 'duplicate');
    expect(deleteFile).toHaveBeenCalledWith(baseJob.storagePath);
  });
});
