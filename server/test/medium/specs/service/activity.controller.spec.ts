import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityController } from 'src/controllers/activity.controller';
import { type KondisDatabase } from 'src/db/database';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { UploadRepository } from 'src/repositories/upload.repository';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';

describe('ActivityController (medium)', () => {
  let testApp: TestApp;
  let db: KondisDatabase;
  let controller: ActivityController;
  let uploads: UploadRepository;
  let activities: ActivityRepository;

  const createActivity = async (startedAt: Date, name: string): Promise<string> => {
    const upload = await uploads.create({
      checksum: crypto.randomUUID().replaceAll('-', ''),
      original_name: `${name}.fit`,
      byte_size: 1,
      storage_path: `seed/${name}.fit`,
    });

    return activities.create({
      activity: {
        upload_id: upload.id,
        sport: 'running',
        sub_sport: null,
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
      streams: [],
      laps: [],
    });
  };

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();

    controller = testApp.get(ActivityController);
    uploads = testApp.get(UploadRepository);
    activities = testApp.get(ActivityRepository);
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
  });

  describe('PUT /activities/:id', () => {
    it('updates the activity name', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'before');

      const updated = await controller.updateById({ id: activityId }, { name: 'after' });

      expect(updated.id).toBe(activityId);
      expect(updated.name).toBe('after');
    });

    it('updates sport, subSport and startedAt', async () => {
      const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'before');

      const updated = await controller.updateById(
        { id: activityId },
        {
          sport: 'trail-running',
          subSport: 'uphill',
          startedAt: '2024-01-01T10:15:00.000Z',
        },
      );

      expect(updated.sport).toBe('trail-running');
      expect(updated.subSport).toBe('uphill');
      expect(updated.startedAt).toBe('2024-01-01T10:15:00.000Z');
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

    it('throws for a missing activity id', async () => {
      await expect(controller.deleteById({ id: MISSING_UUID })).rejects.toThrow(
        `Activity ${MISSING_UUID} does not exist`,
      );
    });
  });
});
