import { describe, expect, it } from 'vitest';

import { serverControllerPing } from '@kondis/sdk';

describe('GET /ping', () => {
  it('should return pong', async () => {
    const response = await serverControllerPing();

    expect(response).toEqual({ status: 'pong' });
  });
});
