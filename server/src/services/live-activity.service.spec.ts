import { ActivityType, LiveActivityStatus } from 'src/enum';
import { NotFoundException } from 'src/errors';
import { type LiveActivityRepository } from 'src/repositories/live-activity.repository';
import { NodeCryptoRepository } from 'src/repositories/node/node-crypto.repository';
import { LiveService } from 'src/services/live-activity.service';
import { newTestService } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const WORKOUT_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';

const liveActivity = (overrides: Record<string, unknown> = {}) => ({
  id: WORKOUT_ID,
  user_id: USER_ID,
  client_session_id: '00000000-0000-4000-8000-000000000003',
  sport: ActivityType.Run,
  started_at: new Date('2026-08-17T08:00:00.000Z'),
  status: LiveActivityStatus.Recording,
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

describe(LiveService.name, () => {
  const getById = vi.fn();
  const getByClientSessionId = vi.fn();
  const create = vi.fn();
  const deleteById = vi.fn(() => Promise.resolve());
  const deleteOtherSessions = vi.fn(() => Promise.resolve());
  const appendPoints = vi.fn(() => Promise.resolve());
  const updateProgress = vi.fn();
  const setShareToken = vi.fn(() => Promise.resolve());
  const listPoints = vi.fn(() => Promise.resolve([]));
  const emit = vi.fn(() => Promise.resolve());

  const repository = {
    getById,
    getByClientSessionId,
    create,
    deleteById,
    deleteOtherSessions,
    appendPoints,
    updateProgress,
    setShareToken,
    listPoints,
  } as unknown as LiveActivityRepository;
  const setup = () =>
    newTestService(LiveService, [repository, new NodeCryptoRepository(), { emit }], { repository, emit });

  beforeEach(() => {
    vi.clearAllMocks();
    getById.mockResolvedValue(liveActivity());
    getByClientSessionId.mockResolvedValue(undefined);
    create.mockResolvedValue(liveActivity());
    updateProgress.mockResolvedValue(liveActivity({ last_sequence: 3 }));
  });

  it('creates a session idempotently from the Android client identifier', async () => {
    const { sut } = setup();

    await sut.create(USER_ID, {
      clientSessionId: '00000000-0000-4000-8000-000000000003',
      sport: ActivityType.Run,
      startedAt: '2026-08-17T08:00:00.000Z',
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID, sport: ActivityType.Run }));
  });

  it('deletes an ended demo activity and its stale predecessor sessions', async () => {
    const { sut } = setup();

    await sut.deleteOtherSessions(USER_ID, '00000000-0000-4000-8000-000000000003');
    await sut.delete(WORKOUT_ID, USER_ID);

    expect(deleteOtherSessions).toHaveBeenCalledWith(USER_ID, '00000000-0000-4000-8000-000000000003');
    expect(deleteById).toHaveBeenCalledWith(WORKOUT_ID, USER_ID);
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
    expect(emit).toHaveBeenCalledWith(
      'LiveActivityUpdated',
      USER_ID,
      expect.objectContaining({
        id: WORKOUT_ID,
        lastSequence: 3,
        position: [11.9, 57.7],
      }),
    );
  });

  it('does not mint a public link for a activity outside the caller account', async () => {
    const { sut } = setup();
    getById.mockResolvedValue(undefined);

    await expect(sut.createShare(WORKOUT_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(setShareToken).not.toHaveBeenCalled();
  });

  it('mints only expiring public links', async () => {
    const { sut } = setup();

    const result = await sut.createShare(WORKOUT_ID, USER_ID);

    expect(result.token).toHaveLength(32);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(setShareToken).toHaveBeenCalledWith(WORKOUT_ID, expect.any(String), expect.any(Date));
  });
});
