import { sql } from 'kysely';
import type { JobRepository } from 'src/contracts/job.repository';
import { ActivityType, BestEffortValueKind, StreamType, UnitSystem } from 'src/enum';
import { hash, type Principal } from 'src/mcp/context';
import { McpOAuthService } from 'src/mcp/oauth';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { McpCredentialRepository } from 'src/repositories/mcp-credential.repository';
import { McpOAuthRepository } from 'src/repositories/mcp-oauth.repository';
import { McpOperationRepository } from 'src/repositories/mcp-operation.repository';
import { McpPreferenceRepository } from 'src/repositories/mcp-preference.repository';
import { PostgresTransactionRepository } from 'src/repositories/postgres-transaction.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { ActivityUploadService } from 'src/services/activity-upload.service';
import { ActivityService } from 'src/services/activity.service';
import { ApiKeyService } from 'src/services/api-key.service';
import { ManualActivitySchema, OperationService } from 'src/services/operation.service';
import { createMediumFactory } from 'test/medium.factory';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';
import { newServiceDeps } from 'test/utils';
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
    queries = new ActivityQueryService(
      newServiceDeps({
        activityRepository: new ActivityRepository(db),
        userRepository: new UserRepository(db),
        mcpPreferenceRepository: new McpPreferenceRepository(db),
      }),
    );
    const transactions = new PostgresTransactionRepository(db);
    operations = new OperationService(
      new McpOperationRepository(db),
      transactions,
      new ActivityService(
        newServiceDeps({
          activityRepository: new ActivityRepository(db),
          uploadRepository: new UploadRepository(db),
          databaseRepository: transactions,
          jobRepository: jobs,
        }),
      ),
      new ActivityUploadService(new UploadRepository(db), jobs),
    );
  });
  afterAll(async () => {
    await db?.destroy();
  });

  it('stores only key hashes, isolates credentials, expires and revokes immediately', async () => {
    const keys = new ApiKeyService(new McpCredentialRepository(db), new PostgresTransactionRepository(db));
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

  it('removes stale route matches and best efforts before queuing recomputation', async () => {
    const activity = await operations.create(owner, manual());
    const matched = await operations.create(owner, manual({ name: 'Matched route' }));
    await db
      .insertInto('activity_route_match')
      .values({ activity_id: activity.activityId!, matched_activity_id: matched.activityId! })
      .execute();
    await db
      .insertInto('activity_best_effort')
      .values({
        activity_id: activity.activityId!,
        type: '5k',
        value: 1800,
        value_kind: BestEffortValueKind.Duration,
        elapsed_time: 1800,
        distance: 5000,
        start_time: 0,
        end_time: 1800,
        avg_hr: null,
        elevation_change: null,
      })
      .execute();
    const current = await queries.get(owner, activity.activityId!);

    await operations.update(owner, {
      id: current.id,
      revision: current.revision,
      idempotencyKey: 'change-sport',
      sport: ActivityType.Yoga,
    });

    await expect(
      db.selectFrom('activity_route_match').selectAll().where('activity_id', '=', current.id).execute(),
    ).resolves.toEqual([]);
    await expect(
      db.selectFrom('activity_best_effort').selectAll().where('activity_id', '=', current.id).execute(),
    ).resolves.toEqual([]);
    expect(jobs.queueAll).toHaveBeenLastCalledWith(
      [
        { name: 'ActivityBestEffortCompute', data: { id: current.id } },
        { name: 'ActivityRouteMatchCompute', data: { id: current.id } },
      ],
      expect.objectContaining({ transaction: expect.anything() }),
    );
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

  it('reads owner preferences with defaults and keeps profile fields private', async () => {
    const initial = await queries.context(owner);
    expect(initial.athlete).toMatchObject({ id: owner.userId, timezone: 'UTC', units: UnitSystem.Metric });
    expect(initial.athlete).not.toHaveProperty('password_hash');
    await db
      .insertInto('mcp_preference')
      .values({
        user_id: owner.userId,
        timezone: 'Europe/Lisbon',
        units: UnitSystem.Imperial,
      })
      .execute();
    const customized = await queries.context(owner);
    expect(customized.athlete).toMatchObject({
      timezone: 'Europe/Lisbon',
      units: UnitSystem.Imperial,
    });
    const otherContext = await queries.context(other);
    expect(otherContext.athlete).toMatchObject({ timezone: 'UTC', units: UnitSystem.Metric });
  });

  it('paginates equal start times and combines owner, text, tag and metric filters', async () => {
    const first = await operations.create(owner, manual({ name: 'Target A', tags: ['workout', 'race'] }));
    const second = await operations.create(owner, manual({ name: 'Target B', tags: ['workout', 'race'] }));
    await operations.create(owner, manual({ name: 'Target short', tags: ['workout', 'race'], distance: 100 }));
    await operations.create(owner, manual({ name: 'Target one tag', tags: ['workout'] }));
    await operations.create(other, manual({ name: 'Target other owner', tags: ['workout', 'race'] }));
    const input = {
      from: '2026-03-29T08:00:00Z',
      to: '2026-03-29T08:00:01Z',
      sport: ActivityType.Run,
      search: 'Target',
      tags: ['workout', 'race'],
      minDistance: 5000,
      maxDistance: 5000,
      minDuration: 1800,
      maxDuration: 1800,
      limit: 1,
    };
    const expected = [first.activityId!, second.activityId!].sort().toReversed();
    const page = await queries.search(owner, input);
    expect(page.activities.map((activity) => activity.id)).toEqual(expected.slice(0, 1));
    expect(page.activities[0]).not.toHaveProperty('track_geojson');
    expect(page.nextCursor).toBeTypeOf('string');
    const next = await queries.search(owner, { ...input, cursor: page.nextCursor! });
    expect(next.activities.map((activity) => activity.id)).toEqual(expected.slice(1));
    expect(next.nextCursor).toBeNull();
    await expect(queries.search(owner, { search: 'run' })).resolves.toMatchObject({ activities: [] });
    await expect(queries.search(owner, { tags: ['unrecognized'] })).resolves.toMatchObject({ activities: [] });
    await expect(queries.search(owner, { to: input.from })).resolves.toMatchObject({ activities: [] });
  });

  it('bounds laps and rejects access to another owner', async () => {
    const created = await operations.create(owner, manual());
    await db
      .insertInto('lap')
      .values(
        Array.from({ length: 201 }, (_, index) => ({
          id: crypto.randomUUID(),
          activity_id: created.activityId!,
          lap_index: index,
          started_at: null,
          elapsed_time: index,
          moving_time: null,
          distance: null,
          avg_hr: null,
          max_hr: null,
          avg_power: null,
          avg_speed_mps: null,
        })),
      )
      .execute();
    const detail = await queries.detail(owner, created.activityId!);
    expect(detail.laps).toHaveLength(200);
    expect(detail.laps[199]).toMatchObject({ lapIndex: 199, elapsedTime: 199, distance: null });
    await expect(queries.detail(other, created.activityId!)).rejects.toThrow('does not exist');
    expect(await new ActivityRepository(db).getLaps(created.activityId!, other.userId, 200)).toEqual([]);
  });

  it('returns no streams for empty windows and preserves nulls for shorter sensors', async () => {
    const created = await operations.create(owner, manual());
    const id = created.activityId!;
    expect(await queries.streams(owner, { id, types: ['heartrate'] })).toEqual([]);
    await db
      .insertInto('activity_stream')
      .values([
        { activity_id: id, type: StreamType.Time, data: [0, 1, 2, 3, 4, 5] },
        { activity_id: id, type: StreamType.Heartrate, data: [100, 101, 102] },
        { activity_id: id, type: StreamType.Latitude, data: [1, 2, 3, 4, 5, 6] },
      ])
      .execute();
    expect(await queries.streams(owner, { id, types: ['heartrate'], from: 10 })).toEqual([]);
    expect(await queries.streams(owner, { id, types: ['power'] })).toEqual([]);
    expect(await queries.streams(owner, { id, types: ['heartrate'], maxPoints: 2 })).toEqual([
      {
        type: 'heartrate',
        values: [100, null],
        times: [0, 3],
        originalPointCount: 6,
        downsampling: 'uniform-index',
      },
    ]);
    expect(await queries.streams(owner, { id, types: ['time'], from: 2, to: 2 })).toMatchObject([
      { values: [2], times: [2], originalPointCount: 1 },
    ]);
    await expect(queries.streams(other, { id, types: ['time'] })).rejects.toThrow('does not exist');
    expect(
      await new ActivityRepository(db).getSampledStreams({
        id,
        userId: other.userId,
        types: [StreamType.Time],
        from: 0,
        maxPoints: 2,
      }),
    ).toEqual([]);
  });

  it('summarizes completed metrics with weighting, zero durations and bounded source IDs', async () => {
    const first = await operations.create(owner, manual({ elapsedTime: 100 }));
    const second = await operations.create(owner, manual({ elapsedTime: 300 }));
    const pending = await operations.create(owner, manual({ elapsedTime: 999 }));
    await db
      .updateTable('activity_metric')
      .set({ avg_hr: 100, avg_power: 200 })
      .where('activity_id', '=', first.activityId!)
      .execute();
    await db
      .updateTable('activity_metric')
      .set({ avg_hr: 140 })
      .where('activity_id', '=', second.activityId!)
      .execute();
    await db
      .updateTable('activity_metric')
      .set({ avg_hr: 999 })
      .where('activity_id', '=', pending.activityId!)
      .execute();
    await db.updateTable('activity').set({ metrics_computed_at: null }).where('id', '=', pending.activityId!).execute();
    const zeroDuration = await operations.create(owner, manual({ startedAt: '2026-04-01T00:00:00Z' }));
    await db
      .updateTable('activity_metric')
      .set({ elapsed_time: 0, avg_hr: 100 })
      .where('activity_id', '=', zeroDuration.activityId!)
      .execute();
    const range = { from: '2026-03-01T00:00:00Z', to: '2026-05-01T00:00:00Z', period: 'month' as const };
    const result = await queries.summarize(owner, range);
    expect(result.periods[0]).toMatchObject({
      period: '2026-03-01 00:00:00',
      activityCount: 3,
      activitiesWithMetrics: 2,
      activitiesWithHeartRate: 2,
      activitiesWithPower: 1,
      elapsedTime: 400,
      weightedHeartRate: 130,
      weightedPower: 200,
    });
    expect(result.periods[1]).toMatchObject({ elapsedTime: 0, weightedHeartRate: null, weightedPower: null });
    const factory = createMediumFactory(db);
    const extra = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        factory.newActivity(owner.userId, new Date(Date.UTC(2026, 2, 30, 0, index)), 'pending', [], null),
      ),
    );
    const summary = await queries.summarize(owner, range);
    expect(summary.periods[0].sampleActivityIds).toEqual(extra.toReversed().slice(0, 20));
    expect(summary.periods[0]).toMatchObject({ activityCount: 28, activitiesWithMetrics: 2, weightedHeartRate: 130 });
    await expect(queries.summarize(owner, { ...range, sport: ActivityType.Ride })).resolves.toMatchObject({
      periods: [],
    });
  });

  it('keeps route and best-effort order and limits in the repository', async () => {
    const first = await operations.create(owner, manual());
    const second = await operations.create(owner, manual());
    const foreign = await operations.create(other, manual());
    const excluded = await operations.create(owner, manual({ startedAt: '2026-03-30T00:00:00Z' }));
    const previousYear = await operations.create(owner, manual({ startedAt: '2025-03-30T00:00:00Z' }));
    await db
      .updateTable('activity')
      .set({ exclude_from_rankings: true })
      .where('id', '=', excluded.activityId!)
      .execute();
    const ids = [first.activityId!, second.activityId!].sort();
    await db
      .insertInto('activity_route_match')
      .values(
        [...ids, foreign.activityId!].map((matchedId) => ({
          activity_id: first.activityId!,
          matched_activity_id: matchedId,
        })),
      )
      .execute();
    const routes = await queries.routes(owner, first.activityId!, 1);
    expect(routes.matches.map((activity) => activity.id)).toEqual([ids[1]]);
    await db
      .insertInto('activity_best_effort')
      .values(
        [...ids, foreign.activityId!, excluded.activityId!, previousYear.activityId!].map((activityId) => ({
          activity_id: activityId,
          type: '5k' as const,
          value: 1800,
          value_kind: BestEffortValueKind.Duration,
          elapsed_time: 1800,
          distance: 5000,
          start_time: 0,
          end_time: 1800,
          avg_hr: null,
          elevation_change: null,
          overall_rank: 1,
          year_rank: 1,
          year: activityId === previousYear.activityId ? 2025 : 2026,
        })),
      )
      .execute();
    const efforts = await queries.bestEfforts(owner, { type: '5k', year: 2026, limit: 1 });
    expect(efforts.map((effort) => effort.activityId)).toEqual([ids[0]]);
    expect(efforts[0]).toMatchObject({ distance: 5000, overallRank: 1, year: 2026 });
  });

  it('validates PKCE, consumes codes once, binds audience and rotates refresh tokens', async () => {
    const transactions = new PostgresTransactionRepository(db);
    const credentialsRepository = new McpCredentialRepository(db);
    const oauth = new McpOAuthService(
      new McpOAuthRepository(db),
      credentialsRepository,
      transactions,
      'https://fitness.example/mcp',
    );
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
    const keys = new ApiKeyService(credentialsRepository, transactions);
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
