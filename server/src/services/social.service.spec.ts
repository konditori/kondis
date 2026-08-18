import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { KondisDatabase } from 'src/db/database';
import type { EventRepository } from 'src/repositories/event.repository';
import { SocialService } from 'src/services/social.service';

const makeService = () => {
  const social = {
    canViewActivity: vi.fn(),
  };
  const service = new SocialService(social as never, {} as KondisDatabase, {} as EventRepository);
  return { service, social };
};

describe(SocialService.name, () => {
  it('rejects likes for activities the viewer cannot access', async () => {
    const { service, social } = makeService();
    social.canViewActivity.mockResolvedValue(undefined);

    await expect(service.like('activity-id', 'viewer-id', true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('commits a notification before emitting its websocket event', async () => {
    const order: string[] = [];
    const eventRepository = {
      emit: vi.fn(() => {
        order.push('emit');
        return Promise.resolve();
      }),
    };
    const db = {
      transaction: () => ({
        execute: (callback: (trx: unknown) => Promise<unknown>) =>
          callback({
            insertInto: () => ({
              values: () => ({
                returningAll: () => ({
                  executeTakeFirstOrThrow: () => {
                    order.push('insert');
                    return Promise.resolve({
                      id: 'notification-id',
                      type: 'activity_like',
                      created_at: new Date('2026-08-18T12:00:00.000Z'),
                      activity_id: 'activity-id',
                    });
                  },
                }),
              }),
            }),
          }).then((row) => {
            order.push('commit');
            return row;
          }),
      }),
    };
    const service = new SocialService({} as never, db as never, eventRepository as never);

    await (
      service as unknown as {
        notify: (...args: unknown[]) => Promise<void>;
      }
    ).notify('recipient-id', 'actor-id', 'activity_like', 'activity-id');

    expect(order).toEqual(['insert', 'commit', 'emit']);
  });

  it('rejects comment reads for activities the viewer cannot access', async () => {
    const { service, social } = makeService();
    social.canViewActivity.mockResolvedValue(undefined);

    await expect(service.comments('activity-id', 'viewer-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects comment creation for activities the viewer cannot access', async () => {
    const { service, social } = makeService();
    social.canViewActivity.mockResolvedValue(undefined);

    await expect(service.addComment('activity-id', 'viewer-id', 'Hello')).rejects.toBeInstanceOf(NotFoundException);
  });
});
