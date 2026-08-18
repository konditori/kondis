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
