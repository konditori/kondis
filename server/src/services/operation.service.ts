import { sql } from 'kysely';
import { ACTIVITY_TAG_IDS } from 'src/constants';
import type { JobRepository } from 'src/contracts/job.repository';
import type { StorageRepository } from 'src/contracts/storage.repository';
import { ActivityType, JobName } from 'src/enum';
import { BadRequestException, ConflictException, NotFoundException } from 'src/errors';
import { hash, requireScope, type Principal, type Scope } from 'src/mcp/context';
import { ActivityRepository } from 'src/repositories/activity.repository';
import type { KondisDatabase, KondisTransaction } from 'src/types';
import { z } from 'zod';

const idempotencyKey = z.string().min(1).max(100);
const tags = z.array(z.enum(ACTIVITY_TAG_IDS)).max(20);
export const ManualActivitySchema = z.object({
  idempotencyKey,
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).default(''),
  sport: z.enum(ActivityType),
  startedAt: z.string().datetime({ offset: true }),
  elapsedTime: z
    .number()
    .int()
    .positive()
    .max(31 * 86_400),
  distance: z.number().nonnegative().max(100_000_000).nullable().default(null),
  tags: tags.default([]),
});
export const UpdateActivitySchema = z
  .object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    idempotencyKey,
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(10_000).optional(),
    sport: z.enum(ActivityType).optional(),
    tags: tags.optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.description !== undefined || v.sport !== undefined || v.tags !== undefined,
    'Provide at least one field to update',
  );
type OperationResult = { activityId?: string; uploadId?: string; status: string; revision?: number };
type StagedUpload = {
  id: string;
  checksum: string;
  original_name: string;
  storage_path: string;
  byte_size: number;
  consumed_at: Date | null;
};

export class OperationService {
  constructor(
    private readonly db: KondisDatabase,
    private readonly jobs: JobRepository,
    private readonly storage?: StorageRepository,
  ) {}

  private async perform(
    principal: Principal,
    kind: string,
    key: string,
    input: unknown,
    execute: (trx: KondisTransaction) => Promise<OperationResult>,
  ) {
    const inputHash = await hash(JSON.stringify(input));
    return this.db.transaction().execute(async (trx) => {
      await sql`SET LOCAL lock_timeout = '5s'`.execute(trx);
      await sql`SET LOCAL statement_timeout = '10s'`.execute(trx);
      // Serialize mutations for this owner, including concurrent retries on different connections.
      await trx
        .selectFrom('user')
        .select('id')
        .where('id', '=', principal.userId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const previous = await sql<{
        id: string;
        input_hash: string;
        result: OperationResult;
      }>`SELECT id, input_hash, result FROM mcp_operation WHERE user_id = ${principal.userId} AND kind = ${kind} AND idempotency_key = ${key}`.execute(
        trx,
      );
      if (previous.rows[0]) {
        if (previous.rows[0].input_hash !== inputHash) {
          throw new ConflictException('Idempotency key already used with different input');
        }
        return { operationId: previous.rows[0].id, ...previous.rows[0].result, replayed: true };
      }
      const result = await execute(trx);
      const inserted = await sql<{
        id: string;
      }>`INSERT INTO mcp_operation(user_id, credential_id, kind, idempotency_key, input_hash, result) VALUES (${principal.userId}, ${principal.credentialId}, ${kind}, ${key}, ${inputHash}, ${JSON.stringify(result)}::jsonb) RETURNING id`.execute(
        trx,
      );
      await sql`INSERT INTO mcp_audit(user_id, credential_id, action, target_id) VALUES (${principal.userId}, ${principal.credentialId}, ${kind}, ${result.activityId ?? result.uploadId ?? null})`.execute(
        trx,
      );
      return { operationId: inserted.rows[0].id, ...result, replayed: false };
    });
  }

  private validateTags(sport: string, value: string[]) {
    if (value.includes('long_run') && !['run', 'trail_run', 'virtual_run'].includes(sport)) {
      throw new BadRequestException('Long Run is only available for run activities');
    }
  }

  async create(principal: Principal, input: z.infer<typeof ManualActivitySchema>) {
    requireScope(principal, 'activities:write');
    const v = ManualActivitySchema.parse(input);
    this.validateTags(v.sport, v.tags);
    return this.perform(principal, 'create_manual_activity', v.idempotencyKey, v, async (trx) => {
      const uploadId = crypto.randomUUID();
      await trx
        .insertInto('upload')
        .values({
          id: uploadId,
          checksum: `manual:${uploadId}`,
          original_name: 'Manual activity',
          storage_path: '',
          byte_size: 0,
          user_id: principal.userId,
          status: 'parsed',
          error: null,
        })
        .execute();
      const repository = new ActivityRepository(this.db);
      const activityId = await repository.create(
        {
          activity: {
            id: crypto.randomUUID(),
            upload_id: uploadId,
            user_id: principal.userId,
            name: v.name,
            description: v.description,
            sport: v.sport,
            tags: v.tags,
            started_at: new Date(v.startedAt),
            timezone_offset_minutes: null,
          },
          streams: [],
          laps: [],
        },
        trx,
      );
      await repository.setMetrics(
        activityId,
        {
          elapsed_time: v.elapsedTime,
          moving_time: null,
          distance: v.distance,
          elevation_gain: null,
          elevation_loss: null,
          avg_speed: v.distance === null ? null : v.distance / v.elapsedTime,
          max_speed: null,
          avg_hr: null,
          max_hr: null,
          avg_cadence: null,
          max_cadence: null,
          avg_power: null,
          max_power: null,
          normalized_power: null,
          calories: null,
        },
        trx,
      );
      await this.jobs.queueAll(
        [
          { name: JobName.ActivityBestEffortCompute, data: { id: activityId } },
          { name: JobName.ActivityRouteMatchCompute, data: { id: activityId } },
        ],
        { transaction: trx },
      );
      return { activityId, status: 'completed' };
    });
  }

  async update(principal: Principal, input: z.infer<typeof UpdateActivitySchema>) {
    requireScope(principal, 'activities:write');
    const v = UpdateActivitySchema.parse(input);
    return this.perform(principal, 'update_activity', v.idempotencyKey, v, async (trx) => {
      const { rows } = await sql<{
        revision: number;
        sport: string;
        tags: string[];
      }>`SELECT revision, sport, tags FROM activity WHERE id = ${v.id}::uuid AND user_id = ${principal.userId} FOR UPDATE`.execute(
        trx,
      );
      const current = rows[0];
      if (!current) {
        throw new NotFoundException('Activity does not exist');
      }
      if (current.revision !== v.revision) {
        throw new ConflictException('Activity changed. Fetch it again and retry with its current revision');
      }
      this.validateTags(v.sport ?? current.sport, v.tags ?? current.tags);
      const sets = [sql`updated_at = now()`];
      if (v.name !== undefined) {
        sets.push(sql`name = ${v.name}`);
      }
      if (v.description !== undefined) {
        sets.push(sql`description = ${v.description}`);
      }
      if (v.sport !== undefined) {
        sets.push(sql`sport = ${v.sport}`);
      }
      if (v.tags !== undefined) {
        sets.push(sql`tags = ${[...new Set(v.tags)]}`);
      }
      if (v.sport !== undefined || v.tags !== undefined) {
        sets.push(sql`best_efforts_computed_at = NULL, route_matches_computed_at = NULL`);
      }
      const changed = await sql<{
        revision: number;
      }>`UPDATE activity SET ${sql.join(sets)} WHERE id = ${v.id}::uuid AND user_id = ${principal.userId} RETURNING revision`.execute(
        trx,
      );
      if (v.sport !== undefined || v.tags !== undefined) {
        await trx.deleteFrom('activity_best_effort').where('activity_id', '=', v.id).execute();
        await trx.deleteFrom('activity_route_match').where('activity_id', '=', v.id).execute();
        await trx.deleteFrom('activity_route_match').where('matched_activity_id', '=', v.id).execute();
        await this.jobs.queueAll(
          [
            { name: JobName.ActivityBestEffortCompute, data: { id: v.id } },
            { name: JobName.ActivityRouteMatchCompute, data: { id: v.id } },
          ],
          { transaction: trx },
        );
      }
      return { activityId: v.id, revision: changed.rows[0].revision, status: 'completed' };
    });
  }

  async stage(principal: Principal, name: string, bytes: Uint8Array) {
    requireScope(principal, 'activities:import');
    if (!this.storage) {
      throw new BadRequestException('Storage is unavailable');
    }
    const extension = /\.(fit|gpx|tcx)$/i.exec(name)?.[0].toLowerCase();
    if (!extension || name.length > 200 || bytes.length === 0 || bytes.length > 20 * 1024 * 1024) {
      throw new BadRequestException('Upload a FIT, GPX or TCX file of at most 20 MiB');
    }
    const id = crypto.randomUUID();
    const checksum = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)),
      (v) => v.toString(16).padStart(2, '0'),
    ).join('');
    const path = this.storage.buildTemporaryPath(extension);
    await this.storage.write(path, Buffer.from(bytes));
    const expiresAt = new Date(Date.now() + 3_600_000);
    try {
      await sql`INSERT INTO mcp_upload(id, user_id, checksum, original_name, storage_path, byte_size, expires_at) VALUES (${id}, ${principal.userId}, ${checksum}, ${name}, ${path}, ${bytes.length}, ${expiresAt})`.execute(
        this.db,
      );
    } catch (error) {
      await this.storage.delete(path).catch(() => {});
      throw error;
    }
    return { uploadId: id, expiresAt: expiresAt.toISOString() };
  }

  async startImport(principal: Principal, input: { uploadId: string; idempotencyKey: string }) {
    requireScope(principal, 'activities:import');
    return this.perform(principal, 'start_activity_import', input.idempotencyKey, input, async (trx) => {
      const { rows } =
        await sql<StagedUpload>`SELECT * FROM mcp_upload WHERE id = ${input.uploadId}::uuid AND user_id = ${principal.userId} AND expires_at > now() FOR UPDATE`.execute(
          trx,
        );
      const staged = rows[0];
      if (!staged) {
        throw new NotFoundException('Upload does not exist or has expired');
      }
      if (staged.consumed_at) {
        throw new ConflictException('Upload already consumed; reuse the original idempotency key');
      }
      await sql`UPDATE mcp_upload SET consumed_at = now() WHERE id = ${staged.id}::uuid`.execute(trx);
      // Insert the durable upload and parser job together. Existing parser owns status transitions.
      const existing = await trx
        .selectFrom('upload')
        .select('id')
        .where('user_id', '=', principal.userId)
        .where('checksum', '=', staged.checksum)
        .executeTakeFirst();
      const uploadId = existing?.id ?? crypto.randomUUID();
      if (!existing) {
        if (!this.storage) {
          throw new BadRequestException('Storage is unavailable');
        }
        const extension = /\.(fit|gpx|tcx)$/i.exec(staged.original_name)![0].toLowerCase();
        const permanentPath = this.storage.buildPath(principal.userId, staged.checksum, extension);
        await this.storage.copy(staged.storage_path, permanentPath);
        await trx
          .insertInto('upload')
          .values({
            id: uploadId,
            user_id: principal.userId,
            checksum: staged.checksum,
            original_name: staged.original_name,
            byte_size: staged.byte_size,
            storage_path: permanentPath,
            error: null,
          })
          .execute();
        await this.jobs.queue({ name: JobName.ActivityParse, data: { id: uploadId } }, { transaction: trx });
      }
      return { uploadId, status: 'queued' };
    });
  }

  async scopeFor(principal: Principal, id: string): Promise<Scope | undefined> {
    const operation = await sql<{
      kind: string;
    }>`SELECT kind FROM mcp_operation WHERE id = ${id}::uuid AND user_id = ${principal.userId}`.execute(this.db);
    if (!operation.rows[0]) {
      return undefined;
    }
    return operation.rows[0].kind === 'start_activity_import' ? 'activities:import' : 'activities:write';
  }

  async get(principal: Principal, id: string) {
    const { rows } = await sql<{
      kind: string;
      result: OperationResult;
    }>`SELECT kind, result FROM mcp_operation WHERE id = ${id}::uuid AND user_id = ${principal.userId}`.execute(
      this.db,
    );
    const operation = rows[0];
    if (!operation) {
      throw new NotFoundException('Operation does not exist');
    }
    requireScope(principal, operation.kind === 'start_activity_import' ? 'activities:import' : 'activities:write');
    if (!operation.result.uploadId) {
      return { operationId: id, ...operation.result };
    }
    const upload = await this.db
      .selectFrom('upload')
      .select(['status', 'error'])
      .where('id', '=', operation.result.uploadId)
      .where('user_id', '=', principal.userId)
      .executeTakeFirst();
    const activities = await this.db
      .selectFrom('activity')
      .select('id')
      .where('upload_id', '=', operation.result.uploadId)
      .where('user_id', '=', principal.userId)
      .limit(100)
      .execute();
    return {
      operationId: id,
      status: upload?.status === 'parsed' ? 'completed' : upload?.status === 'failed' ? 'failed' : 'processing',
      activityIds: activities.map((a) => a.id),
      error: upload?.status === 'failed' ? 'The activity file could not be processed' : null,
    };
  }
}
