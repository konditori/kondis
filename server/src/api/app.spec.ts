import { describe, expect, it, vi } from 'vitest';

import { createApiApp, createOpenApiDocument } from 'src/api/app';
import { newApiDependencies } from 'test/api';

const findNoUser = (_id: string) => Promise.resolve(undefined);
const listNoUsers = () => Promise.resolve([]);

describe('API application', () => {
  it('serves the health check', async () => {
    const ping = vi.fn(() => ({ status: 'pong' }));
    const findById = vi.fn(findNoUser);
    const response = await createApiApp(
      newApiDependencies({ server: { ping }, users: { all: listNoUsers, findById } }),
    ).request('/ping');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'pong' });
    expect(ping).toHaveBeenCalledOnce();
    expect(findById).not.toHaveBeenCalled();
  });

  it('uses the existing internal error response shape', async () => {
    const error = new Error('test failure');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await createApiApp(
      newApiDependencies({
        server: {
          ping: () => {
            throw error;
          },
        },
        users: { all: listNoUsers, findById: vi.fn(findNoUser) },
      }),
    ).request('/ping');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });

  it('preserves the ping operation contract', () => {
    const document = createOpenApiDocument(
      createApiApp(
        newApiDependencies({
          server: { ping: () => ({ status: 'pong' }) },
          users: { all: listNoUsers, findById: vi.fn(findNoUser) },
        }),
      ),
    );

    expect(document.paths['/ping']?.get).toMatchObject({
      operationId: 'ServerController_ping',
      parameters: [],
      summary: 'Health check endpoint',
      tags: ['server'],
      responses: {
        200: {
          description: 'The API is reachable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PingResponseDto_Output' },
            },
          },
        },
      },
    });
  });
});
