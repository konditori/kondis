import { describe, expect, it } from 'vitest';

import { appControllerPing, defaults } from '@kondis/sdk';

const serverUrl = process.env.KONDIS_E2E_SERVER_URL ?? 'http://127.0.0.1:2295';
defaults.baseUrl = serverUrl;

describe('GET /ping', () => {
  it('should return pong', async () => {
    const response = await appControllerPing();

    expect(response).toEqual({ status: 'pong' });
  });
});