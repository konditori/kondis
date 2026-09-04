import type { Server } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import type { ApplicationComposition } from 'src/composition';
import { createApiRuntime } from 'src/main';

describe(createApiRuntime.name, () => {
  it('closes the application while the HTTP server is draining active connections', async () => {
    let finishServerClose: (() => void) | undefined;
    const server = {
      listening: true,
      close: vi.fn((callback: () => void) => {
        finishServerClose = callback;
      }),
    } as unknown as Server;
    const application = {
      close: vi.fn(() => {
        finishServerClose?.();
        return Promise.resolve();
      }),
    } as unknown as ApplicationComposition;
    const runtime = createApiRuntime(application, server);

    await Promise.all([runtime.close(), runtime.close()]);

    expect(server.close).toHaveBeenCalledOnce();
    expect(application.close).toHaveBeenCalledOnce();
  });

  it('reports all close failures after attempting both resources', async () => {
    const serverError = new Error('server close failed');
    const applicationError = new Error('application close failed');
    const server = {
      listening: true,
      close: vi.fn((callback: (error?: Error) => void) => callback(serverError)),
    } as unknown as Server;
    const application = {
      close: vi.fn(() => Promise.reject(applicationError)),
    } as unknown as ApplicationComposition;

    const closing = createApiRuntime(application, server).close();

    await expect(closing).rejects.toEqual(
      expect.objectContaining({
        errors: [serverError, applicationError],
      }),
    );
    expect(server.close).toHaveBeenCalledOnce();
    expect(application.close).toHaveBeenCalledOnce();
  });
});
