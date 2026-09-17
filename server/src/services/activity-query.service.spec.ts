import { BadRequestException } from 'src/errors';
import type { Principal } from 'src/mcp/context';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { BaseService } from 'src/services/base.service';
import { newServiceDeps } from 'test/utils';
import { describe, expect, it } from 'vitest';

const principal: Principal = {
  userId: '00000000-0000-4000-8000-000000000001',
  credentialId: null,
  scopes: new Set(['activities:read']),
};
const id = '00000000-0000-4000-8000-000000000002';
const service = () => new ActivityQueryService(newServiceDeps({}));

describe(ActivityQueryService.name, () => {
  it('uses BaseService dependencies', () => {
    expect(service()).toBeInstanceOf(BaseService);
  });

  it.each(['', '!', btoa('{'), btoa('{}'), btoa(JSON.stringify({ at: 'invalid', id }))])(
    'rejects malformed cursor %j as a client error before querying',
    async (cursor) => {
      await expect(service().search(principal, { cursor })).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('enforces scopes independently of the transport', async () => {
    const denied = { ...principal, scopes: new Set<never>() };
    const sut = service();
    await expect(sut.search(denied, {})).rejects.toThrow('activities:read');
    await expect(sut.compare(denied, [])).rejects.toThrow('activities:read');
    await expect(sut.context(principal)).rejects.toThrow('profile:read');
    await expect(sut.streams(principal, { id, types: ['latitude'] })).rejects.toThrow('location:read');
  });

  it('validates bounds before reading repositories', async () => {
    const sut = service();
    for (const maxPoints of [0, 1, 1001, NaN]) {
      await expect(sut.streams(principal, { id, types: ['time'], maxPoints })).rejects.toHaveProperty(
        'name',
        'ZodError',
      );
    }
    await expect(sut.streams(principal, { id, types: ['time'], from: 20, to: 10 })).rejects.toHaveProperty(
      'name',
      'ZodError',
    );
    await expect(sut.streams(principal, { id, types: ['unsupported'] })).rejects.toHaveProperty('name', 'ZodError');
    await expect(sut.compare(principal, [])).rejects.toHaveProperty('name', 'ZodError');
    await expect(
      sut.compare(
        principal,
        Array.from({ length: 11 }, () => id),
      ),
    ).rejects.toHaveProperty('name', 'ZodError');
    await expect(sut.routes(principal, id, 101)).rejects.toHaveProperty('name', 'ZodError');
    await expect(sut.bestEfforts(principal, { type: 'invalid' })).rejects.toHaveProperty('name', 'ZodError');
  });
});
