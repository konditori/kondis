import { describe, expect, it } from 'vitest';

import { isWebsocketEvent, serializeRealtimeEvent } from 'src/realtime/protocol';

describe('realtime wire protocol', () => {
  it('preserves the client job event format', () => {
    expect(serializeRealtimeEvent('JobUpdated')).toEqual({ type: 'job.updated' });
  });

  it('rejects malformed publications', () => {
    expect(isWebsocketEvent({ type: 'session.revoked' })).toBe(false);
    expect(isWebsocketEvent({ event: 'JobUpdated', args: [] })).toBe(false);
  });
});
