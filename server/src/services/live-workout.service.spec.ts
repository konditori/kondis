import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type LiveWorkoutRepository } from 'src/repositories/live-workout.repository';
import { LiveWorkoutService } from 'src/services/live-workout.service';
import { newTestService } from 'test/utils';

const WORKOUT_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';

const workout = (overrides: Record<string, unknown> = {}) => ({
  id: WORKOUT_ID,
  user_id: USER_ID,
  client_session_id: '00000000-0000-4000-8000-000000000003',
  sport: 'run',
  started_at: new Date('2026-08-17T08:00:00.000Z'),
  status: 'recording',
  elapsed_seconds: 20,
  distance_meters: 100,
  last_sequence: 2,
  last_point_at: new Date('2026-08-17T08:00:20.000Z'),
  last_received_at: new Date('2026-08-17T08:00:20.000Z'),
  share_token_hash: null,
  share_expires_at: null,
  created_at: new Date('2026-08-17T08:00:00.000Z'),
  updated_at: new Date('2026-08-17T08:00:20.000Z'),
  ...overrides,
});

describe(LiveWorkoutService.name, () => {
  const getById = vi.fn();
  const getByClientSessionId = vi.fn();
  const create = vi.fn();
  const appendPoints = vi.fn(() => Promise.resolve());
  const updateProgress = vi.fn();
  const setShareToken = vi.fn(() => Promise.resolve());
  const listPoints = vi.fn(() => Promise.resolve([]));

  const repository = {
    getById,
    getByClientSessionId,
    create,
    appendPoints,
    updateProgress,
    setShareToken,
    listPoints,
  } as unknown as LiveWorkoutRepository;
  const setup = () => newTestService(LiveWorkoutService, [repository], { repository });

  beforeEach(() => {
    vi.clearAllMocks();
    getById.mockResolvedValue(workout());
    getByClientSessionId.mockResolvedValue(undefined);
    create.mockResolvedValue(workout());
    updateProgress.mockResolvedValue(workout({ last_sequence: 3 }));
  });

  it('creates a session idempotently from the Android client identifier', async () => {
    const { sut } = setup();

    await sut.create(USER_ID, {
      clientSessionId: '00000000-0000-4000-8000-000000000003',
      sport: 'run',
      startedAt: '2026-08-17T08:00:00.000Z',
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID, sport: 'run' }));
  });

  it('acknowledges point batches without returning the growing route to the phone', async () => {
    const { sut } = setup();

    await expect(
      sut.appendPoints(WORKOUT_ID, USER_ID, {
        elapsedSeconds: 30,
        distanceMeters: 140,
        points: [
          {
            sequence: 3,
            recordedAt: '2026-08-17T08:00:30.000Z',
            latitude: 57.7,
            longitude: 11.9,
            accuracyMeters: 5,
          },
        ],
      }),
    ).resolves.toEqual({ id: WORKOUT_ID, lastSequence: 3 });
    expect(appendPoints).toHaveBeenCalledOnce();
    expect(listPoints).not.toHaveBeenCalled();
  });

  it('does not mint a public link for a workout outside the caller account', async () => {
    const { sut } = setup();
    getById.mockResolvedValue(undefined);

    await expect(sut.createShare(WORKOUT_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(setShareToken).not.toHaveBeenCalled();
  });
});
