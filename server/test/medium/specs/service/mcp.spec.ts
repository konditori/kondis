import { sql } from 'kysely';
import type { JobRepository } from 'src/contracts/job.repository';
import { ActivityType, StreamType } from 'src/enum';
import { hash, type Principal } from 'src/mcp/context';
import { McpOAuthService } from 'src/mcp/oauth';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { ApiKeyService } from 'src/services/api-key.service';
import { ManualActivitySchema, OperationService } from 'src/services/operation.service';
import { createMediumFactory } from 'test/medium.factory';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const manual = (overrides = {}) =>
  ManualActivitySchema.parse({
    idempotencyKey: crypto.randomUUID(),
    name: 'Morning run',
    sport: ActivityType.Run,
    startedAt: '2026-03-29T08:00:00Z',
    elapsedTime: 1800,
    distance: 5000,
    ...overrides,
  });

describe('MCP persistence and ownership', () => {
  let db: ReturnType<typeof createMediumTestDatabase>;
  let owner: Principal;
  let other: Principal;
  let queries: ActivityQueryService;
  let operations: OperationService;
  let jobs: JobRepository;
  beforeAll(() => {
    db = createMediumTestDatabase();
  });
  beforeEach(async () => {
    await resetMediumTestDatabase(db);
    await sql`TRUNCATE mcp_credential, mcp_oauth_client, mcp_operation, mcp_upload, mcp_audit, mcp_preference CASCADE`.execute(
      db,
    );
    const factory = createMediumFactory(db);
    const ownerUser = await factory.newUser();
    const otherUser = await factory.newUser();
    owner = {
      userId: ownerUser.id,
      credentialId: null,
      scopes: new Set(['activities:read', 'activities:write', 'activities:import', 'profile:read']),
    };
    other = { ...owner, userId: otherUser.id };
    jobs = {
      queue: vi.fn().mockResolvedValue(undefined),
      queueAll: vi.fn().mockResolvedValue(undefined),
      discardQueuedDuplicates: vi.fn().mockResolvedValue(undefined),
    } as unknown as JobRepository;
    queries = new ActivityQueryService(db);
    operations = new OperationService(db, jobs);
  });
  afterAll(async () => {
    await db?.destroy();
  });

  it('stores only key hashes, isolates credentials, expires and revokes immediately', async () => {
    const keys = new ApiKeyService(db);
    const key = await keys.create(owner.userId, { name: 'Test', scopes: ['activities:read'], expiresInDays: 1 });
    const stored = await sql<{
      token_hash: string;
    }>`SELECT token_hash FROM mcp_credential WHERE id = ${key.id}`.execute(db);
    expect(stored.rows[0].token_hash).toBe(await hash(key.secret));
    expect(await keys.list(other.userId)).toEqual([]);
    expect(await keys.authenticate(key.secret, 'https://fitness.example/mcp')).toMatchObject({ userId: owner.userId });
    await keys.revoke(other.userId, key.id);
    expect(await keys.authenticate(key.secret, 'https://fitness.example/mcp')).toBeDefined();
    await keys.revoke(owner.userId, key.id);
    expect(await keys.authenticate(key.secret, 'https://fitness.example/mcp')).toBeUndefined();
  });

  it('serializes concurrent creates, detects key reuse and rolls back when enqueue fails', async () => {
    const input = manual();
    const [first, replay] = await Promise.all([operations.create(owner, input), operations.create(owner, input)]);
    expect(first.activityId).toBe(replay.activityId);
    const created = await queries.search(owner, { limit: 25 });
    expect(created.activities).toHaveLength(1);
    await expect(operations.create(owner, { ...input, name: 'Different' })).rejects.toThrow('different input');
    vi.mocked(jobs.queueAll).mockRejectedValueOnce(new Error('queue unavailable'));
    await expect(operations.create(owner, manual())).rejects.toThrow('queue unavailable');
    const afterFailure = await queries.search(owner, { limit: 25 });
    expect(afterFailure.activities).toHaveLength(1);
  });

  it('isolates activity IDs, cursors, operations and prevents stale updates including REST writes', async () => {
    const first = await operations.create(owner, manual());
    await operations.create(other, manual({ name: 'Other athlete' }));
    await expect(queries.detail(other, first.activityId!)).rejects.toThrow('does not exist');
    await expect(operations.get(other, first.operationId)).rejects.toThrow('does not exist');
    const activity = await queries.get(owner, first.activityId!);
    await db.updateTable('activity').set({ name: 'REST edit' }).where('id', '=', activity.id).execute();
    await expect(
      operations.update(owner, {
        id: activity.id,
        revision: activity.revision,
        idempotencyKey: 'stale',
        name: 'Overwrite',
      }),
    ).rejects.toThrow('Activity changed');
    const otherActivities = await queries.search(other, { limit: 1 });
    expect(otherActivities.activities[0].name).toBe('Other athlete');
    const latest = await queries.get(owner, first.activityId!);
    const updated = await operations.update(owner, {
      id: latest.id,
      revision: latest.revision,
      idempotencyKey: 'edit',
      name: 'New title',
    });
    expect(updated.revision).toBe(latest.revision + 1);
  });

  it('calculates SQL summaries at local week boundaries and preserves missing measurements', async () => {
    await operations.create(owner, manual({ startedAt: '2026-03-29T23:30:00Z' })); // Monday in Lisbon after DST.
    await operations.create(owner, manual({ startedAt: '2026-03-29T00:30:00Z', distance: null }));
    await operations.create(other, manual({ distance: 999_999 }));
    const result = await queries.summarize(owner, {
      from: '2026-03-23T00:00:00Z',
      to: '2026-04-06T00:00:00Z',
      timezone: 'Europe/Lisbon',
      period: 'week',
    });
    expect(result.periods).toEqual([
      expect.objectContaining({
        period: '2026-03-23 00:00:00',
        activityCount: 1,
        distance: null,
        elapsedTime: 1800,
        activitiesWithHeartRate: 0,
        weightedHeartRate: null,
      }),
      expect.objectContaining({ period: '2026-03-30 00:00:00', activityCount: 1, distance: 5000, elapsedTime: 1800 }),
    ]);
  });

  it('returns bounded aligned streams and enforces GPS scope', async () => {
    const activity = await operations.create(owner, manual());
    await db
      .insertInto('activity_stream')
      .values([
        { activity_id: activity.activityId!, type: StreamType.Time, data: Array.from({ length: 2000 }, (_, i) => i) },
        {
          activity_id: activity.activityId!,
          type: StreamType.Heartrate,
          data: Array.from({ length: 2000 }, (_, i) => 100 + i),
        },
      ])
      .execute();
    await expect(
      queries.streams(owner, { id: activity.activityId!, types: ['latitude'], from: 0, maxPoints: 100 }),
    ).rejects.toThrow('location:read');
    const streams = (await queries.streams(owner, {
      id: activity.activityId!,
      types: ['heartrate'],
      from: 100,
      to: 999,
      maxPoints: 100,
    })) as { values: number[]; times: number[]; originalPointCount: number }[];
    expect(streams[0].values).toHaveLength(100);
    expect(streams[0].times[0]).toBe(100);
    expect(streams[0].values[0]).toBe(200);
    expect(streams[0].originalPointCount).toBe(900);
  });

  it('validates PKCE, consumes codes once, binds audience and rotates refresh tokens', async () => {
    const oauth = new McpOAuthService(db, 'https://fitness.example/mcp');
    const client = await oauth.register({
      client_name: 'Test client',
      redirect_uris: ['http://127.0.0.1:1234/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
    const verifier = 'a'.repeat(64);
    const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString(
      'base64url',
    );
    const request = {
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      response_type: 'code' as const,
      code_challenge_method: 'S256' as const,
      code_challenge: challenge,
      resource: oauth.publicUrl,
      scope: 'activities:read',
      state: 'test-state',
    };
    await expect(
      oauth.authorize(owner.userId, { ...request, redirect_uri: 'https://attacker.example' }, true),
    ).rejects.toThrow();
    const redirect = new URL(await oauth.authorize(owner.userId, request, true));
    const form = {
      grant_type: 'authorization_code',
      client_id: client.client_id,
      resource: oauth.publicUrl,
      code: redirect.searchParams.get('code')!,
      redirect_uri: request.redirect_uri,
      code_verifier: verifier,
    };
    await expect(oauth.exchange({ ...form, code_verifier: 'b'.repeat(64) })).rejects.toThrow();
    const credentials = await oauth.exchange(form);
    await expect(oauth.exchange(form)).rejects.toThrow();
    const keys = new ApiKeyService(db);
    expect(await keys.authenticate(credentials.access_token, 'https://wrong.example/mcp')).toBeUndefined();
    expect(await keys.authenticate(credentials.access_token, oauth.publicUrl)).toMatchObject({ userId: owner.userId });
    const refresh = {
      grant_type: 'refresh_token',
      client_id: client.client_id,
      resource: oauth.publicUrl,
      refresh_token: credentials.refresh_token,
    };
    const rotated = await oauth.exchange(refresh);
    await expect(oauth.exchange(refresh)).rejects.toThrow();
    expect(await keys.authenticate(credentials.access_token, oauth.publicUrl)).toBeUndefined();
    await oauth.revoke(rotated.access_token, client.client_id);
    expect(await keys.authenticate(rotated.access_token, oauth.publicUrl)).toBeUndefined();
  });
});
