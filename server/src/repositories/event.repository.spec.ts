import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import type { ConfigRepository } from 'src/repositories/config.repository';
import { EventRepository } from 'src/repositories/event.repository';
import type { SocialRepository } from 'src/repositories/social.repository';
import type { KondisDatabase } from 'src/types';

vi.mock('pg', () => ({
  default: {
    Client: class extends EventEmitter {
      connect = vi.fn(() => Promise.resolve());
      query = vi.fn(() => Promise.resolve());
      end = vi.fn(() => Promise.resolve());
    },
  },
}));

describe(EventRepository.name, () => {
  it('destroys upgrade sockets for unmatched paths', async () => {
    const server = createServer();
    const repository = new EventRepository(
      {} as KondisDatabase,
      { database: {} } as ConfigRepository,
      {} as SocialRepository,
    );
    const socket = { destroy: vi.fn() };
    await repository.attach(server);

    server.emit('upgrade', { url: '/not-events' }, socket, Buffer.alloc(0));

    expect(socket.destroy).toHaveBeenCalledOnce();
    await repository.stop();
  });
});
