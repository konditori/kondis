import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from 'src/auth';
import { type KondisDatabase } from 'src/db/database';
import { QueueName } from 'src/enum';
import { ActivityRepository, type ActivityStreamInput } from 'src/repositories/activity.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { ActivityService } from 'src/services/activity.service';

import { createMediumFactory } from 'test/medium.factory';
import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';

describe(ActivityService.name, () => {
  let testApp: TestApp;
  let db: KondisDatabase;
  let activities: ActivityRepository;
  let uploads: UploadRepository;
  let sut: ActivityService;
  let jobs: JobRepository;
  let factory: ReturnType<typeof createMediumFactory>;
  let testUser: AuthenticatedUser;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();

    activities = testApp.get(ActivityRepository);
    uploads = testApp.get(UploadRepository);
    sut = testApp.get(ActivityService);
    jobs = testApp.get(JobRepository);
    factory = createMediumFactory(db);
  });

  beforeEach(async () => {
    await resetMediumTestDatabase(db);
    testUser = await factory.newUser();
  });

  const createActivity = (
    startedAt: Date,
    name: string,
    streams: ActivityStreamInput[] = [],
    sport: 'run' | 'ride' = 'run',
  ) => factory.newActivity(testUser.id, startedAt, name, streams, {}, sport);

  const serviceApi = {
    listRecent: (query: Parameters<ActivityService['listRecent']>[0]) => sut.listRecent(query, testUser.id),
    listBestEfforts: (params: {
      sport: Parameters<ActivityService['listBestEfforts']>[0];
      type: Parameters<ActivityService['listBestEfforts']>[1];
    }) => sut.listBestEfforts(params.sport, params.type, testUser.id),
    getById: async ({ id }: { id: string }) => {
      const activity = await sut.getById(id, testUser.id);
      if (!activity) {
        throw new Error(`Activity ${id} does not exist`);
      }
      return activity;
    },
    listMatchedRoutes: async ({ id }: { id: string }) => {
      const matches = await sut.listMatchedRoutes(id, testUser.id);
      if (!matches) {
        throw new Error(`Activity ${id} does not exist`);
      }
      return matches;
    },
    updateById: async (
      { id }: { id: string },
      payload: {
        name?: string;
        description?: string;
        sport?: 'run' | 'ride' | 'trail_run';
        startedAt?: string;
        excludeFromRankings?: boolean;
      },
    ) => {
      const updated = await sut.updateById(id, testUser.id, {
        ...payload,
        startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
      });
      if (!updated) {
        throw new Error(`Activity ${id} does not exist`);
      }
      return updated;
    },
    deleteById: ({ id }: { id: string }) => sut.deleteById(id, testUser.id),
  };

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  describe('GET /activities', () => {
    it('returns activities in reverse chronological order', async () => {
      await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'older');
      const newerId = await createActivity(new Date('2024-01-01T09:00:00.000Z'), 'newer');

      const response = await serviceApi.listRecent({ limit: 50 });

      expect(response.activities).toHaveLength(2);
      expect(response.activities[0].id).toBe(newerId);
      expect(response.activities[1].name).toBe('older');
      expect(response.nextCursor).toBeNull();
      expect(response.total).toBe(2);
    });

    it('serializes timestamps as ISO strings', async () => {
      await createActivity(new Date('2024-01-01T09:00:00.000Z'), 'newer');

      const response = await serviceApi.listRecent({ limit: 50 });
      expect(response.activities[0].startedAt).toBe('2024-01-01T09:00:00.000Z');
    });

    it('includes the simplified GPS route needed for activity feed maps', async () => {
      await createActivity(new Date('2024-01-01T09:00:00.000Z'), 'mapped run', [
        { type: 'latitude', data: [58.4101, 58.4112, 58.4124] },
        { type: 'longitude', data: [15.6211, 15.6222, 15.6234] },
      ]);

      const response = await serviceApi.listRecent({ limit: 50 });
      expect(response.activities[0].track).toEqual({
        type: 'LineString',
        coordinates: [
          [15.6211, 58.4101],
          [15.6234, 58.4124],
        ],
      });
    });

    it('paginates through every activity without duplicates', async () => {
      await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'oldest');
      await createActivity(new Date('2024-01-01T09:00:00.000Z'), 'middle');
      await createActivity(new Date('2024-01-01T10:00:00.000Z'), 'newest');

      const first = await serviceApi.listRecent({ limit: 2 });
      expect(first.activities.map(({ name }) => name)).toEqual(['newest', 'middle']);
      expect(first.nextCursor).not.toBeNull();
      expect(first.total).toBe(3);

      const second = await serviceApi.listRecent({ limit: 2, cursor: first.nextCursor ?? undefined });
      expect(second.activities.map(({ name }) => name)).toEqual(['oldest']);
      expect(second.nextCursor).toBeNull();
      expect(second.total).toBe(3);
    });

    it('includes up to three distinct achievement ranks for each activity', async () => {
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

      const response = await serviceApi.listRecent({ limit: 50 });
      const second = response.activities.find(({ id }) => id === secondId);
      const fourth = response.activities.find(({ name }) => name === 'fourth');

      expect(second?.topBestEfforts).toHaveLength(1);
      expect(second?.topBestEfforts?.every(({ overallRank }) => overallRank === 2)).toBe(true);
      expect(second?.topBestEfforts?.every(({ yearRank }) => yearRank === 2)).toBe(true);
      expect(fourth?.topBestEfforts).toEqual([]);
    });

    it('includes power medals in the activity summary', async () => {
      const activityId = await createActivity(
        new Date('2024-05-01T08:00:00.000Z'),
        'ride with power medals',
        [
          { type: 'distance', data: [0, 5000, 10_000] },
          { type: 'time', data: [0, 600, 1200] },
          { type: 'power', data: Array.from({ length: 31 }, (_, index) => (index >= 10 ? 300 : 100)) },
        ],
        'ride',
      );

      const activities = await serviceApi.listRecent({ limit: 50 });
      const activity = activities.activities.find(({ id }) => id === activityId);

      expect(activity?.topBestEfforts?.some(({ type }) => type.startsWith('power_'))).toBe(true);
      expect(activity?.achievementCount).toBeGreaterThan(activity?.topBestEfforts?.length ?? 0);
    });
  });

  describe('GET /activities/best-efforts', () => {
    it('assigns consecutive podium rankings to the three fastest efforts', async () => {
      await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'bronze', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1500] },
      ]);
      await createActivity(new Date('2024-02-01T08:00:00.000Z'), 'gold', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1300] },
      ]);
      await createActivity(new Date('2024-03-01T08:00:00.000Z'), 'silver', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1400] },
      ]);
      await createActivity(new Date('2024-04-01T08:00:00.000Z'), 'outside podium', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1600] },
      ]);

      const response = await serviceApi.listBestEfforts({ sport: 'run', type: '5k' });

      expect(response.efforts.map(({ activityName, overallRank }) => ({ activityName, overallRank }))).toEqual([
        { activityName: 'bronze', overallRank: 3 },
        { activityName: 'gold', overallRank: 1 },
        { activityName: 'silver', overallRank: 2 },
        { activityName: 'outside podium', overallRank: 4 },
      ]);
    });

    it('removes an excluded podium activity and reranks the remaining efforts', async () => {
      const goldId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'bad GPS gold', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1300] },
      ]);
      await createActivity(new Date('2024-02-01T08:00:00.000Z'), 'silver becomes gold', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1400] },
      ]);
      await createActivity(new Date('2024-03-01T08:00:00.000Z'), 'bronze becomes silver', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1500] },
      ]);
      await createActivity(new Date('2024-04-01T08:00:00.000Z'), 'fourth becomes bronze', [
        { type: 'distance', data: [0, 5000] },
        { type: 'time', data: [0, 1600] },
      ]);

      await serviceApi.updateById({ id: goldId }, { excludeFromRankings: true });
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);

      const history = await serviceApi.listBestEfforts({ sport: 'run', type: '5k' });
      expect(history.efforts.map(({ activityName, overallRank }) => ({ activityName, overallRank }))).toEqual([
        { activityName: 'silver becomes gold', overallRank: 1 },
        { activityName: 'bronze becomes silver', overallRank: 2 },
        { activityName: 'fourth becomes bronze', overallRank: 3 },
      ]);

      const excludedActivity = await serviceApi.getById({ id: goldId });
      expect(excludedActivity.excludeFromRankings).toBe(true);
      expect(excludedActivity.bestEfforts?.find(({ type }) => type === '5k')).toMatchObject({ elapsedTime: 1300 });
    });

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

      const response = await serviceApi.listBestEfforts({ sport: 'run', type: '5k' });

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
      await sut.handleActivityBestEffortCompute({ id: rideId });

      const response = await serviceApi.listBestEfforts({ sport: 'ride', type: '20k' });

      expect(response.sport).toBe('ride');
      expect(response.options.map(({ type }) => type)).toContain('longest_ride');
      expect(response.options.map(({ type }) => type)).not.toContain('power_1h');
      expect(response.options.map(({ type }) => type)).not.toContain('100k');
      expect(response.efforts).toHaveLength(1);
      expect(response.efforts[0]).toMatchObject({ activityId: rideId, value: 2400 });
    });
  });

  describe('GET /activities/:id', () => {
    it('returns null analysis fields while computations are pending', async () => {
      const activityId = await factory.newPendingActivity(testUser.id);

      const activity = await serviceApi.getById({ id: activityId });
      const list = await serviceApi.listRecent({ limit: 50 });
      const matches = await serviceApi.listMatchedRoutes({ id: activityId });

      expect(activity.metrics).toBeNull();
      expect(activity.bestEfforts).toBeNull();
      expect(activity.matchedRouteCount).toBeNull();
      expect(list.activities[0].topBestEfforts).toBeNull();
      expect(matches.activities).toBeNull();
    });

    it('returns persisted running best efforts in standard-distance order', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'run', [
        { type: 'distance', data: [0, 400, 1000, 1700] },
        { type: 'time', data: [0, 100, 250, 425] },
        { type: 'heartrate', data: [100, 120, 140, 160] },
        { type: 'altitude', data: [10, 15, 7, 20] },
      ]);

      const activity = await serviceApi.getById({ id: activityId });

      expect(activity.bestEfforts?.map(({ type }) => type)).toEqual(['400m', '1k', 'half_mile', '1_mile']);
      expect(activity.bestEfforts?.find(({ type }) => type === '1_mile')?.elapsedTime).toBeCloseTo(402.336);
      expect(activity.bestEfforts?.find(({ type }) => type === '1k')).toMatchObject({
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

      const activity = await serviceApi.getById({ id: activityId });

      expect(activity.bestEfforts?.find(({ type }) => type === '1k')).toMatchObject({
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
        { type: 'latitude', data: [59, 59.000001, 59.000002] },
        { type: 'longitude', data: [18, 18.000001, 18.000002] },
      ]);

      const activity = await serviceApi.getById({ id: activityId });

      expect(activity.track?.coordinates).toHaveLength(3);
      await expect(
        db
          .selectFrom('activity')
          .select(({ ref }) => ref('detail_track').$castTo<string | null>().as('detail_track'))
          .where('id', '=', activityId)
          .executeTakeFirstOrThrow(),
      ).resolves.toMatchObject({ detail_track: expect.anything() });
    });

    it('groups repeated GPS tracks while excluding nearby and reversed routes', async () => {
      const first = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'first route effort', [
        { type: 'latitude', data: [59.3293, 59.333, 59.337, 59.3293] },
        { type: 'longitude', data: [18.0686, 18.074, 18.07, 18.0686] },
      ]);
      // The same route with uneven, slightly noisy recording intervals. Comparing the raw
      // vertices produces a large discrete Frechet distance despite the lines overlapping.
      const second = await createActivity(new Date('2024-02-01T08:00:00.000Z'), 'same direction with GPS drift', [
        {
          type: 'latitude',
          data: [
            59.32932, 59.330265, 59.33111, 59.332115, 59.33305, 59.33404, 59.33496, 59.33604, 59.33702, 59.335115,
            59.33311, 59.331265, 59.32931,
          ],
        },
        {
          type: 'longitude',
          data: [
            18.06861, 18.06995, 18.0713, 18.07265, 18.07403, 18.073, 18.072, 18.071, 18.07004, 18.06965, 18.0693,
            18.06895, 18.06859,
          ],
        },
      ]);
      const lateStart = await createActivity(new Date('2024-02-10T08:00:00.000Z'), 'same route with a late start', [
        { type: 'latitude', data: [59.32999, 59.333, 59.337, 59.3293] },
        { type: 'longitude', data: [18.06963, 18.074, 18.07, 18.0686] },
      ]);
      await createActivity(new Date('2024-02-15T08:00:00.000Z'), 'same loop in reverse', [
        { type: 'latitude', data: [59.3293, 59.337, 59.333, 59.3293] },
        { type: 'longitude', data: [18.0686, 18.07, 18.074, 18.0686] },
      ]);
      await createActivity(new Date('2024-03-01T08:00:00.000Z'), 'different route', [
        { type: 'latitude', data: [59.3293, 59.333, 59.337, 59.3293] },
        { type: 'longitude', data: [18.0686, 18.079, 18.075, 18.0686] },
      ]);

      const detail = await serviceApi.getById({ id: first });
      const response = await serviceApi.listMatchedRoutes({ id: first });

      expect(detail.matchedRouteCount).toBe(3);
      expect(response.activities?.map(({ id }) => id)).toEqual([first, second, lateStart]);

      await db.deleteFrom('activity_route_match').where('activity_id', '=', first).execute();
      const detailAfterRemovingPersistedMatches = await serviceApi.getById({ id: first });
      expect(detailAfterRemovingPersistedMatches.matchedRouteCount).toBe(0);
    });

    it('returns no route matches for an activity without GPS data', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'indoor run');

      const activity = await serviceApi.getById({ id: activityId });

      expect(activity.matchedRouteCount).toBe(0);
    });

    it('does not compute missing best efforts while reading an activity', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'older run', [
        { type: 'distance', data: [0, 400, 1000] },
        { type: 'time', data: [0, 100, 250] },
      ]);
      await db.deleteFrom('activity_best_effort').where('activity_id', '=', activityId).execute();

      const activity = await serviceApi.getById({ id: activityId });

      expect(activity.bestEfforts).toEqual([]);
      await expect(
        db.selectFrom('activity_best_effort').selectAll().where('activity_id', '=', activityId).execute(),
      ).resolves.toEqual([]);
    });
  });

  describe('PUT /activities/:id', () => {
    it('updates the activity name and description', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'before');

      const updated = await serviceApi.updateById({ id: activityId }, { name: 'after', description: 'A lovely run' });

      expect(updated.id).toBe(activityId);
      expect(updated.name).toBe('after');
      expect(updated.description).toBe('A lovely run');
    });

    it('updates sport and startedAt', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'before');

      const updated = await serviceApi.updateById(
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
      const initialActivity = await serviceApi.getById({ id: activityId });
      expect(initialActivity.bestEfforts).toHaveLength(3);

      await serviceApi.updateById({ id: activityId }, { sport: 'ride' });
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);
      const rideActivity = await serviceApi.getById({ id: activityId });
      expect(rideActivity.bestEfforts).toEqual([]);

      await serviceApi.updateById({ id: activityId }, { sport: 'run' });
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);
      const runActivity = await serviceApi.getById({ id: activityId });
      expect(runActivity.bestEfforts).toHaveLength(3);
    });

    it('refreshes persisted ranking years after the activity date changes', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'dated run', [
        { type: 'distance', data: [0, 1000] },
        { type: 'time', data: [0, 250] },
      ]);

      await serviceApi.updateById({ id: activityId }, { startedAt: '2025-01-01T08:00:00.000Z' });
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

    it('returns no activity for a missing activity id', async () => {
      await expect(sut.updateById(MISSING_UUID, testUser.id, { name: 'x' })).resolves.toBeUndefined();
    });
  });

  describe('DELETE /activities/:id', () => {
    it('deletes the activity row', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'to-delete');

      await serviceApi.deleteById({ id: activityId });

      expect(await activities.getById(activityId)).toBeUndefined();
    });

    it('deletes the source upload row through cascade flow', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'to-delete');
      const activityBefore = await activities.getById(activityId);
      expect(activityBefore).toBeDefined();

      await serviceApi.deleteById({ id: activityId });

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

      await serviceApi.deleteById({ id: firstId });
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

    it('returns false for a missing activity id', async () => {
      await expect(serviceApi.deleteById({ id: MISSING_UUID })).resolves.toBe(false);
    });
  });
});
