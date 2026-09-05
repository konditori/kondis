/// <reference types="@cloudflare/vitest-plugin/types" />

import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createCloudflareCryptoAdapter } from 'src/adapters/cloudflare/crypto.adapter';
import { parseQueueBindingName } from 'src/cloudflare/entrypoint';
import { QueueName } from 'src/enum';

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

  it('maps deployed queue resource names back to domain queue names', () => {
    expect(parseQueueBindingName('kondis-api-pr42-background-task')).toEqual({
      deadLetter: false,
      name: QueueName.BackgroundTask,
    });
    expect(parseQueueBindingName('kondis-api-pr42-background-task-dlq')).toEqual({
      deadLetter: true,
      name: QueueName.BackgroundTask,
    });
  });

  it('supports bcrypt password verification inside workerd', async () => {
    const crypto = createCloudflareCryptoAdapter();
    const passwordHash = await crypto.hashPassword('long enough password', 4);

    expect(passwordHash).toMatch(/^\$2b\$04\$/);
    await expect(crypto.comparePassword('long enough password', passwordHash)).resolves.toBe(true);
    await expect(crypto.comparePassword('wrong password', passwordHash)).resolves.toBe(false);
  });

  it('produces standard SHA-256 hashes inside workerd', async () => {
    const crypto = createCloudflareCryptoAdapter();
    const expected = '0967115f2813a3541eaef77de9d9d5773f1c0c04314b0bbfe4ff3b3b1c55b5d5';

    await expect(crypto.sha256('same')).resolves.toBe(expected);
    await expect(crypto.sha256(new TextEncoder().encode('same'))).resolves.toBe(expected);
  });
});
