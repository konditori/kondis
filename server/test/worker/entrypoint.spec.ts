/// <reference types="@cloudflare/vitest-plugin/types" />

import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('Cloudflare Worker entrypoint', () => {
  const worker = exports.default;

  it('serves the health boundary inside workerd', async () => {
    const response = await worker.fetch(new Request('https://kondis.example/api/v1/ping'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'pong' });
  });

  it('does not expose the Hyperdrive probe without its secret binding', async () => {
    const response = await worker.fetch(
      new Request('https://kondis.example/api/v1/_internal/hyperdrive-spike', {
        headers: { Authorization: 'Bearer attacker-controlled' },
      }),
    );

    expect(response.status).toBe(404);
  });
});
