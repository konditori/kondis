import { ACTIVITY_TAG_IDS } from 'src/constants';
import type { StorageRepository } from 'src/contracts/storage.repository';
import type { TransactionRepository } from 'src/contracts/transaction.repository';
import { ActivityType } from 'src/enum';
import { BadRequestException, ConflictException, NotFoundException } from 'src/errors';
import { hash, requireScope, type Principal, type Scope } from 'src/mcp/context';
import type { McpOperationRepository, McpOperationResult } from 'src/repositories/mcp-operation.repository';
import type { ActivityUploadService } from 'src/services/activity-upload.service';
import type { ActivityService } from 'src/services/activity.service';
import type { KondisTransaction } from 'src/types';
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
export class OperationService {
  constructor(
    private readonly operations: McpOperationRepository,
    private readonly transactions: TransactionRepository,
    private readonly activities: ActivityService,
    private readonly activityUploads: ActivityUploadService,
    private readonly storage?: StorageRepository,
  ) {}

  private async perform(
    principal: Principal,
    kind: string,
    key: string,
    input: unknown,
    execute: (trx: KondisTransaction) => Promise<McpOperationResult>,
  ) {
    const inputHash = await hash(JSON.stringify(input));
    return this.transactions.withTransaction(async (transaction) => {
      await this.operations.configureTransaction(transaction);
      // Serialize mutations for this owner, including concurrent retries on different connections.
      await this.operations.lockOwner(principal.userId, transaction);
      const previous = await this.operations.findByKey(principal.userId, kind, key, transaction);
      if (previous) {
        if (previous.input_hash !== inputHash) {
          throw new ConflictException('Idempotency key already used with different input');
        }
        return { operationId: previous.id, ...previous.result, replayed: true };
      }
      const result = await execute(transaction);
      const operationId = await this.operations.record(
        {
          userId: principal.userId,
          credentialId: principal.credentialId,
          kind,
          key,
          inputHash,
          result,
        },
        transaction,
      );
      return { operationId, ...result, replayed: false };
    });
  }

  async create(principal: Principal, input: z.infer<typeof ManualActivitySchema>) {
    requireScope(principal, 'activities:write');
    const v = ManualActivitySchema.parse(input);
    return this.perform(principal, 'create_manual_activity', v.idempotencyKey, v, async (trx) => {
      const activityId = await this.activities.createDirectActivityInTransaction(
        principal.userId,
        {
          name: v.name,
          description: v.description,
          sport: v.sport,
          tags: v.tags,
          startedAt: v.startedAt,
          timezoneOffsetMinutes: null,
          metrics: {
            elapsedTime: v.elapsedTime,
            movingTime: null,
            distance: v.distance,
            elevationGain: null,
            elevationLoss: null,
            avgSpeed: v.distance === null ? null : v.distance / v.elapsedTime,
            maxSpeed: null,
            avgHr: null,
            maxHr: null,
            avgCadence: null,
            maxCadence: null,
            avgPower: null,
            maxPower: null,
            normalizedPower: null,
            calories: null,
          },
          streams: [],
          laps: [],
        },
        trx,
        { originalName: 'Manual activity', checksumPrefix: 'manual' },
      );
      return { activityId, status: 'completed' };
    });
  }

  async update(principal: Principal, input: z.infer<typeof UpdateActivitySchema>) {
    requireScope(principal, 'activities:write');
    const v = UpdateActivitySchema.parse(input);
    return this.perform(principal, 'update_activity', v.idempotencyKey, v, async (trx) => {
      const updated = await this.activities.updateByIdInTransaction(
        v.id,
        principal.userId,
        {
          expectedRevision: v.revision,
          name: v.name,
          description: v.description,
          sport: v.sport,
          tags: v.tags,
        },
        trx,
      );
      if (!updated) {
        throw new NotFoundException('Activity does not exist');
      }
      return { activityId: v.id, revision: updated.revision, status: 'completed' };
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
      await this.operations.createStagedUpload({
        id,
        userId: principal.userId,
        checksum,
        originalName: name,
        storagePath: path,
        byteSize: bytes.length,
        expiresAt,
      });
    } catch (error) {
      await this.storage.delete(path).catch(() => {});
      throw error;
    }
    return { uploadId: id, expiresAt: expiresAt.toISOString() };
  }

  async startImport(principal: Principal, input: { uploadId: string; idempotencyKey: string }) {
    requireScope(principal, 'activities:import');
    return this.perform(principal, 'start_activity_import', input.idempotencyKey, input, async (trx) => {
      const staged = await this.operations.findStagedUpload(input.uploadId, principal.userId, trx);
      if (!staged) {
        throw new NotFoundException('Upload does not exist or has expired');
      }
      if (staged.consumed_at) {
        throw new ConflictException('Upload already consumed; reuse the original idempotency key');
      }
      await this.operations.consumeStagedUpload(staged.id, trx);
      // Insert the durable upload and parser job together. Existing parser owns status transitions.
      const existing = await this.activityUploads.findExisting(principal.userId, staged.checksum, trx);
      let uploadId = existing?.id;
      if (!existing) {
        if (!this.storage) {
          throw new BadRequestException('Storage is unavailable');
        }
        const extension = /\.(fit|gpx|tcx)$/i.exec(staged.original_name)![0].toLowerCase();
        const permanentPath = this.storage.buildPath(principal.userId, staged.checksum, extension);
        await this.storage.copy(staged.storage_path, permanentPath);
        const registration = await this.activityUploads.registerInTransaction(
          {
            id: crypto.randomUUID(),
            user_id: principal.userId,
            checksum: staged.checksum,
            original_name: staged.original_name,
            byte_size: staged.byte_size,
            storage_path: permanentPath,
          },
          trx,
        );
        uploadId = registration.upload.id;
      }
      return { uploadId: uploadId!, status: 'queued' };
    });
  }

  async scopeFor(principal: Principal, id: string): Promise<Scope | undefined> {
    const operation = await this.operations.findKind(id, principal.userId);
    if (!operation) {
      return undefined;
    }
    return operation.kind === 'start_activity_import' ? 'activities:import' : 'activities:write';
  }

  async get(principal: Principal, id: string) {
    const operation = await this.operations.find(id, principal.userId);
    if (!operation) {
      throw new NotFoundException('Operation does not exist');
    }
    requireScope(principal, operation.kind === 'start_activity_import' ? 'activities:import' : 'activities:write');
    if (!operation.result.uploadId) {
      return { operationId: id, ...operation.result };
    }
    const upload = await this.operations.findUploadStatus(operation.result.uploadId, principal.userId);
    const activityIds = await this.operations.listActivityIds(operation.result.uploadId, principal.userId);
    return {
      operationId: id,
      status: upload?.status === 'parsed' ? 'completed' : upload?.status === 'failed' ? 'failed' : 'processing',
      activityIds,
      error: upload?.status === 'failed' ? 'The activity file could not be processed' : null,
    };
  }
}
