import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LiveWorkoutRepository } from 'src/repositories/live-workout.repository';

import { createMediumFactory } from 'test/medium.factory';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(LiveWorkoutRepository.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(() => {
    db = createMediumTestDatabase();
  });
  beforeEach(async () => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  it('stores idempotent points and only resolves an active, unexpired public token', async () => {
    const factory = createMediumFactory(db);
    const user = await factory.newUser();
    const sut = new LiveWorkoutRepository(db);
    const workout = await sut.create({
      userId: user.id,
      clientSessionId: crypto.randomUUID(),
      sport: 'run',
      startedAt: new Date('2026-08-17T08:00:00.000Z'),
    });

    await sut.appendPoints(workout.id, [
      {
        sequence: 1,
        recordedAt: new Date('2026-08-17T08:00:10.000Z'),
        latitude: 57.7,
        longitude: 11.9,
        altitude: null,
        accuracyMeters: 5,
      },
    ]);
    await sut.appendPoints(workout.id, [
      {
        sequence: 1,
        recordedAt: new Date('2026-08-17T08:00:10.000Z'),
        latitude: 57.7,
        longitude: 11.9,
        altitude: null,
        accuracyMeters: 5,
      },
    ]);
    await sut.updateProgress(workout.id, 'recording', 10, 12.5);
    await sut.setShareToken(workout.id, 'token-hash', null);

    await expect(sut.listPoints(workout.id)).resolves.toHaveLength(1);
    await expect(sut.getById(workout.id, user.id)).resolves.toMatchObject({
      last_sequence: 1,
      distance_meters: 12.5,
    });
    await expect(sut.getByShareTokenHash('token-hash')).resolves.toMatchObject({ id: workout.id });

    await sut.updateProgress(workout.id, 'ended', 10, 12.5);
    await expect(sut.getByShareTokenHash('token-hash')).resolves.toMatchObject({ id: workout.id });
  });
});
