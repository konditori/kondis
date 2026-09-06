import { describe, expect, it, vi } from 'vitest';

import { DurableObjectRealtimeAdapter } from 'src/cloudflare/realtime-durable-object';

describe('DurableObjectRealtimeAdapter', () => {
  it('publishes events through the namespace', async () => {
    let published: Request | undefined;
    const fetch = vi.fn((request: Request | string, init?: RequestInit) => {
      published = request instanceof Request ? request : new Request(request, init);
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const namespace = {
      idFromName: vi.fn(() => 'global-id'),
      get: vi.fn(() => ({ fetch })),
    };
    const adapter = new DurableObjectRealtimeAdapter(namespace);

    await adapter.emit('JobUpdated');

    expect(namespace.idFromName).toHaveBeenCalledWith('global');
    expect(fetch).toHaveBeenCalledOnce();
    await expect(published?.json()).resolves.toEqual({ event: 'JobUpdated', args: [] });
  });

  it('swallows delivery failures so database mutations remain successful', async () => {
    const namespace = {
      idFromName: () => 'global-id',
      get: () => ({ fetch: vi.fn(() => Promise.reject(new Error('unavailable'))) }),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(new DurableObjectRealtimeAdapter(namespace).emit('JobUpdated')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});
