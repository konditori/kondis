import type { Server } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import type { ApplicationComposition } from 'src/composition.node';
import { createApiRuntime } from 'src/main';

describe(createApiRuntime.name, () => {
  it('waits for active HTTP connections to drain before closing the application', async () => {
    let finishServerClose: (() => void) | undefined;
    const server = {
      listening: true,
      close: vi.fn((callback: () => void) => {
        finishServerClose = callback;
      }),
    } as unknown as Server;
    const application = {
      eventRepository: { stop: vi.fn(() => Promise.resolve()) },
      close: vi.fn(() => Promise.resolve()),
    } as unknown as ApplicationComposition;
    const runtime = createApiRuntime(application, server);

    const closing = runtime.close();

    expect(application.eventRepository.stop).toHaveBeenCalledOnce();
    expect(application.close).not.toHaveBeenCalled();

    finishServerClose?.();
    await closing;

    expect(server.close).toHaveBeenCalledOnce();
    expect(application.close).toHaveBeenCalledOnce();
  });

  it('stops realtime connections so the HTTP server can finish draining', async () => {
    let finishServerClose: (() => void) | undefined;
    const order: string[] = [];
    const server = {
      listening: true,
      close: vi.fn((callback: () => void) => {
        order.push('server');
        finishServerClose = callback;
      }),
    } as unknown as Server;
    const application = {
      eventRepository: {
        stop: vi.fn(() => {
          order.push('realtime');
          finishServerClose?.();
          return Promise.resolve();
        }),
      },
      close: vi.fn(() => {
        order.push('application');
        return Promise.resolve();
      }),
    } as unknown as ApplicationComposition;
    const runtime = createApiRuntime(application, server);

    await Promise.all([runtime.close(), runtime.close()]);

    expect(order).toEqual(['server', 'realtime', 'application']);
    expect(server.close).toHaveBeenCalledOnce();
    expect(application.eventRepository.stop).toHaveBeenCalledOnce();
    expect(application.close).toHaveBeenCalledOnce();
  });

  it('reports all close failures after attempting every shutdown phase', async () => {
    const serverError = new Error('server close failed');
    const eventError = new Error('event stop failed');
    const applicationError = new Error('application close failed');
    const server = {
      listening: true,
      close: vi.fn((callback: (error?: Error) => void) => callback(serverError)),
    } as unknown as Server;
    const application = {
      eventRepository: { stop: vi.fn(() => Promise.reject(eventError)) },
      close: vi.fn(() => Promise.reject(applicationError)),
    } as unknown as ApplicationComposition;

    const closing = createApiRuntime(application, server).close();

    await expect(closing).rejects.toEqual(
      expect.objectContaining({
        errors: [serverError, eventError, applicationError],
      }),
    );
    expect(server.close).toHaveBeenCalledOnce();
    expect(application.eventRepository.stop).toHaveBeenCalledOnce();
    expect(application.close).toHaveBeenCalledOnce();
  });
});
