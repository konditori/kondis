import { ConsoleLogger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobName, JobStatus } from 'src/enum';
import { type ActivityRepository } from 'src/repositories/activity.repository';
import { type DatabaseRepository } from 'src/repositories/database.repository';
import { FitDecodeError, type FitRepository } from 'src/repositories/fit.repository';
import { type JobRepository } from 'src/repositories/job.repository';
import { type StorageRepository } from 'src/repositories/storage.repository';
import { type UploadRepository } from 'src/repositories/upload.repository';
import { ActivityService } from 'src/services/activity.service';

const UPLOAD_ID = 'upload-1';

const anUpload = (overrides: Record<string, unknown> = {}) => ({
  id: UPLOAD_ID,
  storage_path: 'ab/cd/abcd.fit',
  ...overrides,
});

describe('ActivityService', () => {
  const getUploadById = vi.fn();
  const setStatus = vi.fn(async () => {});
  const deleteUpload = vi.fn(async () => {});
  const getIdsToParse = vi.fn<(options: { force: boolean; after?: string; limit: number }) => Promise<string[]>>();

  const read = vi.fn<(relativePath: string) => Promise<Buffer>>();

  const getActivityById = vi.fn();
  const getByUploadId = vi.fn();
  const createActivity = vi.fn<(input: unknown) => Promise<string>>();
  const deleteActivity = vi.fn(async () => {});

  const withTransaction = vi.fn(async (fn: (trx: unknown) => Promise<unknown>) => fn('trx'));

  const queue = vi.fn(async () => {});
  const queueAll = vi.fn(async () => {});

  const decode = vi.fn();

  const uploadRepository = {
    getById: getUploadById,
    setStatus,
    delete: deleteUpload,
    getIdsToParse,
  } as unknown as UploadRepository;

  const storageRepository = { read } as unknown as StorageRepository;

  const activityRepository = {
    getById: getActivityById,
    getByUploadId,
    create: createActivity,
    delete: deleteActivity,
  } as unknown as ActivityRepository;

  const databaseRepository = { withTransaction } as unknown as DatabaseRepository;
  const jobRepository = { queue, queueAll } as unknown as JobRepository;
  const fitRepository = { decode } as unknown as FitRepository;

  const makeService = () =>
    new ActivityService(
      uploadRepository,
      storageRepository,
      activityRepository,
      databaseRepository,
      jobRepository,
      fitRepository,
      new ConsoleLogger({ logLevels: [] }),
    );

  const decodesTo = (startedAt = new Date('2024-03-01T06:00:00.000Z')) => {
    decode.mockReturnValue({ recordMesgs: [{ timestamp: startedAt, heartRate: 120 }] });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getUploadById.mockResolvedValue(anUpload());
    getByUploadId.mockResolvedValue(undefined);
    getActivityById.mockResolvedValue(undefined);
    getIdsToParse.mockResolvedValue([]);
    createActivity.mockResolvedValue('activity-1');
    read.mockResolvedValue(Buffer.from('not actually a fit file'));
    decodesTo();
  });

  describe('handleActivityParse', () => {
    it('skips an upload that no longer exists', async () => {
      getUploadById.mockResolvedValue(undefined);

      await expect(makeService().handleActivityParse({ id: UPLOAD_ID })).resolves.toBe(JobStatus.Skipped);
      expect(read).not.toHaveBeenCalled();
    });

    it('skips an upload that already produced an activity', async () => {
      getByUploadId.mockResolvedValue({ id: 'activity-1' });

      await expect(makeService().handleActivityParse({ id: UPLOAD_ID })).resolves.toBe(JobStatus.Skipped);
      expect(deleteActivity).not.toHaveBeenCalled();
      expect(createActivity).not.toHaveBeenCalled();
    });

    it('replaces the existing activity when forced', async () => {
      getByUploadId.mockResolvedValue({ id: 'stale-activity' });

      await expect(makeService().handleActivityParse({ id: UPLOAD_ID, force: true })).resolves.toBe(JobStatus.Success);
      expect(deleteActivity).toHaveBeenCalledWith('stale-activity');
      expect(createActivity).toHaveBeenCalledTimes(1);
    });

    it('reads, decodes and stores the activity, then marks the upload parsed', async () => {
      const contents = Buffer.from('fit bytes');
      read.mockResolvedValue(contents);

      await expect(makeService().handleActivityParse({ id: UPLOAD_ID })).resolves.toBe(JobStatus.Success);

      expect(read).toHaveBeenCalledWith('ab/cd/abcd.fit');
      expect(decode).toHaveBeenCalledWith(contents);
      expect(createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ activity: expect.objectContaining({ upload_id: UPLOAD_ID }) }),
      );
      expect(setStatus).toHaveBeenCalledWith(UPLOAD_ID, 'parsed');
    });

    it('records the failure on the upload and rethrows so the queue can retry', async () => {
      decode.mockImplementation(() => {
        throw new FitDecodeError('File is not a valid FIT file: Incorrect header size');
      });

      await expect(makeService().handleActivityParse({ id: UPLOAD_ID })).rejects.toThrow(FitDecodeError);

      expect(setStatus).toHaveBeenCalledWith(
        UPLOAD_ID,
        'failed',
        'File is not a valid FIT file: Incorrect header size',
      );
      expect(createActivity).not.toHaveBeenCalled();
    });

    it('records a non-Error throw as a string rather than losing it', async () => {
      decode.mockImplementation(() => {
        throw 'kaboom';
      });

      await expect(makeService().handleActivityParse({ id: UPLOAD_ID })).rejects.toBe('kaboom');
      expect(setStatus).toHaveBeenCalledWith(UPLOAD_ID, 'failed', 'kaboom');
    });
  });

  describe('handleActivityParseQueueAll', () => {
    it('enqueues nothing when there is nothing to parse', async () => {
      await expect(makeService().handleActivityParseQueueAll({})).resolves.toBe(JobStatus.Success);
      expect(queueAll).not.toHaveBeenCalled();
    });

    it('pages until the repository runs dry, resuming after the last id of each page', async () => {
      getIdsToParse.mockResolvedValueOnce(['a', 'b']).mockResolvedValueOnce(['c']).mockResolvedValueOnce([]);

      await expect(makeService().handleActivityParseQueueAll({})).resolves.toBe(JobStatus.Success);

      expect(getIdsToParse).toHaveBeenCalledTimes(3);
      expect(getIdsToParse.mock.calls[0][0]).toMatchObject({ after: undefined });
      expect(getIdsToParse.mock.calls[1][0]).toMatchObject({ after: 'b' });
      expect(getIdsToParse.mock.calls[2][0]).toMatchObject({ after: 'c' });
      expect(queueAll).toHaveBeenCalledTimes(2);
    });

    // Backfill jobs must not starve an upload someone is actively waiting on.
    it('tags every queued job as backfill and propagates force', async () => {
      getIdsToParse.mockResolvedValueOnce(['a']).mockResolvedValueOnce([]);

      await makeService().handleActivityParseQueueAll({ force: true });

      expect(queueAll).toHaveBeenCalledWith([{ name: JobName.ActivityParse, data: { id: 'a', force: true } }]);
      expect(getIdsToParse.mock.calls[0][0]).toMatchObject({ force: true });
    });

    it('defaults force to false', async () => {
      getIdsToParse.mockResolvedValueOnce(['a']).mockResolvedValueOnce([]);

      await makeService().handleActivityParseQueueAll({});

      expect(getIdsToParse.mock.calls[0][0]).toMatchObject({ force: false });
    });
  });

  describe('handleActivityDelete', () => {
    it('skips an activity that no longer exists', async () => {
      await expect(makeService().handleActivityDelete({ id: 'activity-1' })).resolves.toBe(JobStatus.Skipped);
      expect(withTransaction).not.toHaveBeenCalled();
    });

    // The row delete and the file-delete job must commit together, otherwise a crash between
    // them either orphans the file or removes a file whose row survived.
    it('deletes the upload and enqueues the file delete in one transaction', async () => {
      getActivityById.mockResolvedValue({ id: 'activity-1', upload_id: UPLOAD_ID });
      getUploadById.mockResolvedValue(anUpload({ storage_path: 'ab/cd/abcd.fit' }));

      await expect(makeService().handleActivityDelete({ id: 'activity-1' })).resolves.toBe(JobStatus.Success);

      expect(withTransaction).toHaveBeenCalledTimes(1);
      expect(deleteUpload).toHaveBeenCalledWith(UPLOAD_ID, 'trx');
      expect(queue).toHaveBeenCalledWith(
        { name: JobName.FileDelete, data: { paths: ['ab/cd/abcd.fit'] } },
        { transaction: 'trx' },
      );
    });

    it('still deletes the rows when the upload row is already gone', async () => {
      getActivityById.mockResolvedValue({ id: 'activity-1', upload_id: UPLOAD_ID });
      getUploadById.mockResolvedValue(undefined);

      await expect(makeService().handleActivityDelete({ id: 'activity-1' })).resolves.toBe(JobStatus.Success);

      expect(deleteUpload).toHaveBeenCalledWith(UPLOAD_ID, 'trx');
      expect(queue).not.toHaveBeenCalled();
    });
  });
});
