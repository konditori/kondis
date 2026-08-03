import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityController } from 'src/controllers/activity.controller';
import { type KondisDatabase } from 'src/db/database';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { UploadRepository } from 'src/repositories/upload.repository';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, truncateAllTables, truncateJobs } from 'test/medium/test-db';

const hasMediumDb = Boolean(process.env.KONDIS_TEST_POSTGRES_URL);
const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';

describe.skipIf(!hasMediumDb)('ActivityController (medium)', () => {
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
    await truncateJobs(db);
    await truncateAllTables(db);
  });

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  it('lists recent activities in reverse chronological order', async () => {
    await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'older');
    const newerId = await createActivity(new Date('2024-01-01T09:00:00.000Z'), 'newer');

    const response = await controller.listRecent();

    expect(response.activities).toHaveLength(2);
    expect(response.activities[0].id).toBe(newerId);
    expect(response.activities[0].name).toBe('newer');
    expect(response.activities[0].startedAt).toBe('2024-01-01T09:00:00.000Z');
    expect(response.activities[1].name).toBe('older');
  });

  it('updates mutable activity fields', async () => {
    const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'before');

    const updated = await controller.updateById(
      { id: activityId },
      {
        name: 'after',
        sport: 'trail-running',
        subSport: 'uphill',
        startedAt: '2024-01-01T10:15:00.000Z',
      },
    );

    expect(updated.id).toBe(activityId);
    expect(updated.name).toBe('after');
    expect(updated.sport).toBe('trail-running');
    expect(updated.subSport).toBe('uphill');
    expect(updated.startedAt).toBe('2024-01-01T10:15:00.000Z');
  });

  it('throws for update of a missing activity', async () => {
    await expect(controller.updateById({ id: MISSING_UUID }, { name: 'x' })).rejects.toThrow(
      `Activity ${MISSING_UUID} does not exist`,
    );
  });

  it('deletes an activity and its upload row', async () => {
    const activityId = await createActivity(new Date('2024-01-01T08:00:00.000Z'), 'to-delete');
    const activityBefore = await activities.getById(activityId);
    expect(activityBefore).toBeDefined();

    await controller.deleteById({ id: activityId });

    expect(await activities.getById(activityId)).toBeUndefined();
    expect(await uploads.getById(activityBefore!.upload_id)).toBeUndefined();
  });

  it('throws for delete of a missing activity', async () => {
    await expect(controller.deleteById({ id: MISSING_UUID })).rejects.toThrow(
      `Activity ${MISSING_UUID} does not exist`,
    );
  });
});
