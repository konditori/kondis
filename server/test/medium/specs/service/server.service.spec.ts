import { describe, expect, it } from 'vitest';

import { ServerService } from 'src/services/server.service';

import { createTestApp } from 'test/medium/test-app';

describe(ServerService.name, () => {
  it('returns the health response', async () => {
    const testApp = await createTestApp();
    const { sut } = { sut: testApp.get(ServerService) };

    try {
      expect(sut.ping()).toEqual({ status: 'pong' });
    } finally {
      await testApp.destroy();
    }
  });
});
