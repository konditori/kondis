import { describe, expect, it } from 'vitest';

import { isWebsocketEvent, serializeRealtimeEvent } from 'src/realtime/protocol';

describe('realtime wire protocol', () => {
  it('preserves the client job event format', () => {
    expect(serializeRealtimeEvent('JobUpdated')).toEqual({ type: 'job.updated' });
  });

  it('serializes live workout updates for the owning user', () => {
    expect(
      serializeRealtimeEvent('LiveWorkoutUpdated', 'user-id', {
        id: 'workout-id',
        status: 'recording',
        elapsedSeconds: 1,
        distanceMeters: 4.7,
        lastSequence: 1,
        recordedAt: '2026-09-08T12:00:01.000Z',
        position: [18.07, 59.33],
      }),
    ).toMatchObject({ type: 'live-workout.updated', userId: 'user-id' });
  });

  it('rejects malformed publications', () => {
    expect(isWebsocketEvent({ type: 'session.revoked' })).toBe(false);
    expect(isWebsocketEvent({ event: 'JobUpdated', args: [] })).toBe(false);
  });
});
