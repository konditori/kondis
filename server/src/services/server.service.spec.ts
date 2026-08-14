import { describe, expect, it } from 'vitest';

import { ServerService } from 'src/services/server.service';
import { newTestService } from 'test/utils';

const setup = () => newTestService(ServerService, [], {});

describe(ServerService.name, () => {
  it('returns pong from the health check', () => {
    const { sut } = setup();

    expect(sut.ping()).toEqual({ status: 'pong' });
  });
});
