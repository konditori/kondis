import request from 'supertest';
import { describe, expect, it } from 'vitest';

const serverUrl = process.env.KONDIS_E2E_SERVER_URL ?? 'http://127.0.0.1:2295';

describe('GET /ping', () => {
  it('should return pong', async () => {
    const { status, text } = await request(serverUrl).get('/ping');

    expect(status).toBe(200);
    expect(text).toBe('pong');
  });
});