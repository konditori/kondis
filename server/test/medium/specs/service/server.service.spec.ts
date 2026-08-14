import { describe, expect, it } from 'vitest';

import { ServerService } from 'src/services/server.service';

describe(ServerService.name, () => {
  it('returns the health response', async () => {
    expect(new ServerService().ping()).toEqual({ status: 'pong' });
  });
});
