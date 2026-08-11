import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityController } from 'src/controllers/activity.controller';
import { type KondisDatabase } from 'src/db/database';
import { QueueName } from 'src/enum';
import { ActivityRepository, ActivityStreamInput } from 'src/repositories/activity.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { ActivityService } from 'src/services/activity.service';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';

describe('ActivityController (medium)', () => {
  let testApp: TestApp;
  let db: KondisDatabase;
  let controller: ActivityController;
  let uploads: UploadRepository;
  let activities: ActivityRepository;
  let activityService: ActivityService;
  let jobs: JobRepository;

  const createActivity = async (
    startedAt: Date,
    name: string,
    streams: ActivityStreamInput[] = [],
  ): Promise<string> => {
    const upload = await uploads.create({
      checksum: crypto.randomUUID().replaceAll('-', ''),
      original_name: `${name}.fit`,
      byte_size: 1,
      storage_path: `seed/${name}.fit`,
    });

    const id = await activities.create({
      activity: {
        upload_id: upload.id,
        sport: 'run',
        name,
        started_at: startedAt,
        timezone_offset_minutes: 0,
      },
      metrics: {
        elapsed_time: 3600,
        moving_time: 3500,
        distance: 10_000,
        elevation_gain: 100,
        elevation_loss: 100,
        avg_speed: 2.8,
        max_speed: 4.9,
        avg_hr: 150,
        max_hr: 175,
        avg_cadence: 168,
        max_cadence: 190,
        avg_power: 210,
        max_power: 420,
        normalized_power: 230,
        calories: 700,
      },
      streams,
      laps: [],
    });
    await activities.refreshBestEffortRankings();
    return id;
  };

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();

    controller = testApp.get(ActivityController);
    uploads = testApp.get(UploadRepository);
    activities = testApp.get(ActivityRepository);
    activityService = testApp.get(ActivityService);
    jobs = testApp.get(JobRepository);
  }, 60_000);

  beforeEach(async () => {
    await resetMediumTestDatabase(db);
  });

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  describe('GET /activities', () => {
    it('returns activities in reverse chronological order', async () => {
      await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'older');
      const newerId = await createActivity(new Date('2024-01-01T09:00:00.000Z'), 'newer');

      const response = await controller.listRecent({ limit: 50 });

      expect(response.activities).toHaveLength(2);
      expect(response.activities[0].id).toBe(newerId);
      expect(response.activities[1].name).toBe('older');
      expect(response.nextCursor).toBeNull();
      expect(response.total).toBe(2);
    });

    it('serializes timestamps as ISO strings', async () => {
      await createActivity(new Date('2024-01-01T09:00:00.000Z'), 'newer');

      const response = await controller.listRecent({ limit: 50 });
      expect(response.activities[0].startedAt).toBe('2024-01-01T09:00:00.000Z');
    });

    it('paginates through every activity without duplicates', async () => {
      await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'oldest');
      await createActivity(new Date('2024-01-01T09:00:00.000Z'), 'middle');
      await createActivity(new Date('2024-01-01T10:00:00.000Z'), 'newest');

      const first = await controller.listRecent({ limit: 2 });
      expect(first.activities.map(({ name }) => name)).toEqual(['newest', 'middle']);
      expect(first.nextCursor).not.toBeNull();
      expect(first.total).toBe(3);

      const second = await controller.listRecent({ limit: 2, cursor: first.nextCursor ?? undefined });
      expect(second.activities.map(({ name }) => name)).toEqual(['oldest']);
      expect(second.nextCursor).toBeNull();
      expect(second.total).toBe(3);
    });

    it('includes up to three yearly podium efforts for each activity', async () => {
      await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'fastest', [
        { type: 'distance', data: [0, 400, 1000] },
        { type: 'time', data: [0, 100, 250] },
      ]);
      const secondId = await createActivity(new Date('2024-02-01T08:00:00.000Z'), 'second', [
        { type: 'distance', data: [0, 400, 1000] },
        { type: 'time', data: [0, 110, 270] },
      ]);
      await createActivity(new Date('2024-03-01T08:00:00.000Z'), 'third', [
        { type: 'distance', data: [0, 400, 1000] },
        { type: 'time', data: [0, 120, 290] },
      ]);
      await createActivity(new Date('2024-04-01T08:00:00.000Z'), 'fourth', [
        { type: 'distance', data: [0, 400, 1000] },
        { type: 'time', data: [0, 130, 310] },
      ]);

      const response = await controller.listRecent({ limit: 50 });
      const second = response.activities.find(({ id }) => id === secondId);
      const fourth = response.activities.find(({ name }) => name === 'fourth');

      expect(second?.topBestEfforts).toHaveLength(3);
      expect(second?.topBestEfforts.every(({ yearRank }) => yearRank === 2)).toBe(true);
      expect(fourth?.topBestEfforts).toEqual([]);
    });
  });

  describe('GET /activities/best-efforts', () => {
    it('ranks overall and yearly efforts while preserving chronological order', async () => {
      const first = await createActivity(new Date('2023-06-01T08:00:00.000Z'), 'first', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1500] },
      ]);
      const yearlyBest = await createActivity(new Date('2024-05-01T08:00:00.000Z'), 'yearly best', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1400] },
      ]);
      await createActivity(new Date('2024-08-01T08:00:00.000Z'), 'later', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1450] },
      ]);

      const response = await controller.listBestEfforts({ sport: 'run', type: '5k' });

      expect(response.type).toBe('5k');
      expect(response.efforts.map(({ activityName }) => activityName)).toEqual(['first', 'yearly best', 'later']);
      expect(response.efforts.find(({ activityId }) => activityId === first)).toMatchObject({
        overallRank: 3,
        yearRank: 1,
      });
      expect(response.efforts.find(({ activityId }) => activityId === yearlyBest)).toMatchObject({
        overallRank: 1,
        yearRank: 1,
      });
    });

    it('returns cycling efforts separately from running efforts', async () => {
      const rideId = await createActivity(new Date('2024-06-01T08:00:00.000Z'), 'fast ride', [
        { type: 'distance', data: [0, 5000, 10_000, 20_000] },
        { type: 'time', data: [0, 600, 1200, 2400] },
      ]);
      await activities.update(rideId, { sport: 'ride' });
      await activityService.handleActivityBestEffortCompute({ id: rideId });

      const response = await controller.listBestEfforts({ sport: 'ride', type: '20k' });

      expect(response.sport).toBe('ride');
      expect(response.options.map(({ type }) => type)).toContain('longest_ride');
      expect(response.options.map(({ type }) => type)).not.toContain('power_1h');
      expect(response.options.map(({ type }) => type)).not.toContain('100k');
      expect(response.efforts).toHaveLength(1);
      expect(response.efforts[0]).toMatchObject({ activityId: rideId, value: 2400 });
    });
  });

  describe('GET /activities/:id', () => {
    it('returns persisted running best efforts in standard-distance order', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'run', [
        { type: 'distance', data: [0, 400, 1000, 1700] },
        { type: 'time', data: [0, 100, 250, 425] },
        { type: 'heartrate', data: [100, 120, 140, 160] },
        { type: 'altitude', data: [10, 15, 7, 20] },
      ]);

      const activity = await controller.getById({ id: activityId });

      expect(activity.bestEfforts.map(({ type }) => type)).toEqual(['400m', '1k', 'half_mile', '1_mile']);
      expect(activity.bestEfforts.find(({ type }) => type === '1_mile')?.elapsedTime).toBeCloseTo(402.336);
      expect(activity.bestEfforts.find(({ type }) => type === '1k')).toMatchObject({
        avgHr: 120,
        elevationChange: -3,
        overallRank: 1,
      });
    });

    it('includes each effort ranking for the activity calendar year', async () => {
      await createActivity(new Date('2024-02-01T08:00:00.000Z'), 'fastest', [
        { type: 'distance', data: [0, 1000] },
        { type: 'time', data: [0, 230] },
      ]);
      await createActivity(new Date('2024-03-01T08:00:00.000Z'), 'second', [
        { type: 'distance', data: [0, 1000] },
        { type: 'time', data: [0, 240] },
      ]);
      const activityId = await createActivity(new Date('2024-04-01T08:00:00.000Z'), 'third', [
        { type: 'distance', data: [0, 1000] },
        { type: 'time', data: [0, 250] },
      ]);
      await createActivity(new Date('2023-04-01T08:00:00.000Z'), 'another year', [
        { type: 'distance', data: [0, 1000] },
        { type: 'time', data: [0, 220] },
      ]);

      const activity = await controller.getById({ id: activityId });

      expect(activity.bestEfforts.find(({ type }) => type === '1k')).toMatchObject({
        overallRank: 4,
        year: 2024,
        yearRank: 3,
      });

      await expect(
        db
          .selectFrom('activity_best_effort')
          .select(['year', 'year_rank'])
          .where('activity_id', '=', activityId)
          .where('type', '=', '1k')
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ year: 2024, year_rank: 3 });
    });

    it('returns the persisted full-resolution detail track', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'mapped run', [
        { type: 'latitude', data: [59, 59.000_001, 59.000_002] },
        { type: 'longitude', data: [18, 18.000_001, 18.000_002] },
      ]);

      const activity = await controller.getById({ id: activityId });

      expect(activity.track?.coordinates).toHaveLength(3);
      await expect(
        db
          .selectFrom('activity')
          .select(({ ref }) => ref('detail_track').$castTo<string | null>().as('detail_track'))
          .where('id', '=', activityId)
          .executeTakeFirstOrThrow(),
      ).resolves.toMatchObject({ detail_track: expect.anything() });
    });

    it('does not compute missing best efforts while reading an activity', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'older run', [
        { type: 'distance', data: [0, 400, 1000] },
        { type: 'time', data: [0, 100, 250] },
      ]);
      await db.deleteFrom('activity_best_effort').where('activity_id', '=', activityId).execute();

      const activity = await controller.getById({ id: activityId });

      expect(activity.bestEfforts).toEqual([]);
      await expect(
        db.selectFrom('activity_best_effort').selectAll().where('activity_id', '=', activityId).execute(),
      ).resolves.toEqual([]);
    });
  });

  describe('PUT /activities/:id', () => {
    it('updates the activity name and description', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'before');

      const updated = await controller.updateById({ id: activityId }, { name: 'after', description: 'A lovely run' });

      expect(updated.id).toBe(activityId);
      expect(updated.name).toBe('after');
      expect(updated.description).toBe('A lovely run');
    });

    it('updates sport and startedAt', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'before');

      const updated = await controller.updateById(
        { id: activityId },
        {
          sport: 'trail_run',
          startedAt: '2024-01-01T10:15:00.000Z',
        },
      );
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);

      expect(updated.sport).toBe('trail_run');
      expect(updated.startedAt).toBe('2024-01-01T10:15:00.000Z');
    });

    it('removes and recomputes running best efforts when the activity type changes', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'before', [
        { type: 'distance', data: [0, 400, 1000] },
        { type: 'time', data: [0, 100, 250] },
      ]);
      const initialActivity = await controller.getById({ id: activityId });
      expect(initialActivity.bestEfforts).toHaveLength(3);

      await controller.updateById({ id: activityId }, { sport: 'ride' });
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);
      const rideActivity = await controller.getById({ id: activityId });
      expect(rideActivity.bestEfforts).toEqual([]);

      await controller.updateById({ id: activityId }, { sport: 'run' });
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);
      const runActivity = await controller.getById({ id: activityId });
      expect(runActivity.bestEfforts).toHaveLength(3);
    });

    it('refreshes persisted ranking years after the activity date changes', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'dated run', [
        { type: 'distance', data: [0, 1000] },
        { type: 'time', data: [0, 250] },
      ]);

      await controller.updateById({ id: activityId }, { startedAt: '2025-01-01T08:00:00.000Z' });
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);

      await expect(
        db
          .selectFrom('activity_best_effort')
          .select('year')
          .where('activity_id', '=', activityId)
          .where('type', '=', '1k')
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ year: 2025 });
    });

    it('throws for a missing activity id', async () => {
      await expect(controller.updateById({ id: MISSING_UUID }, { name: 'x' })).rejects.toThrow(
        `Activity ${MISSING_UUID} does not exist`,
      );
    });
  });

  describe('DELETE /activities/:id', () => {
    it('deletes the activity row', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'to-delete');

      await controller.deleteById({ id: activityId });

      expect(await activities.getById(activityId)).toBeUndefined();
    });

    it('deletes the source upload row through cascade flow', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'to-delete');
      const activityBefore = await activities.getById(activityId);
      expect(activityBefore).toBeDefined();

      await controller.deleteById({ id: activityId });

      expect(await uploads.getById(activityBefore!.upload_id)).toBeUndefined();
    });

    it('refreshes persisted rankings after deletion', async () => {
      const firstId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'first', [
        { type: 'distance', data: [0, 1000] },
        { type: 'time', data: [0, 230] },
      ]);
      const secondId = await createActivity(new Date('2024-02-01T08:00:00.000Z'), 'second', [
        { type: 'distance', data: [0, 1000] },
        { type: 'time', data: [0, 240] },
      ]);

      await controller.deleteById({ id: firstId });
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);

      await expect(
        db
          .selectFrom('activity_best_effort')
          .select(['overall_rank', 'year_rank'])
          .where('activity_id', '=', secondId)
          .where('type', '=', '1k')
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ overall_rank: 1, year_rank: 1 });
    });

    it('throws for a missing activity id', async () => {
      await expect(controller.deleteById({ id: MISSING_UUID })).rejects.toThrow(
        `Activity ${MISSING_UUID} does not exist`,
      );
    });
  });
});
