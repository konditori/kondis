import { describe, expect, it, vi } from 'vitest';

import { HttpRealtimeRepository } from 'src/repositories/http-realtime.repository';

describe(HttpRealtimeRepository.name, () => {
  it('sends the stable wire event with its bearer token', async () => {
    const request = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 204 })));
    await new HttpRealtimeRepository('https://worker.example/publish', 'shared-token', request).emit('JobUpdated');

    expect(request).toHaveBeenCalledWith(
      'https://worker.example/publish',
      expect.objectContaining({
        headers: { Authorization: 'Bearer shared-token', 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'job.updated' }),
      }),
    );
  });
});
