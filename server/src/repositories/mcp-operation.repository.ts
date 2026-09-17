import { sql } from 'kysely';
import type { KondisDatabase, KondisTransaction } from 'src/types';

export type McpOperationResult = { activityId?: string; uploadId?: string; status: string; revision?: number };

export class McpOperationRepository {
  constructor(private readonly db: KondisDatabase) {}

  async configureTransaction(transaction: KondisTransaction): Promise<void> {
    await sql`SET LOCAL lock_timeout = '5s'`.execute(transaction);
    await sql`SET LOCAL statement_timeout = '10s'`.execute(transaction);
  }

  lockOwner(userId: string, transaction: KondisTransaction) {
    return transaction.selectFrom('user').select('id').where('id', '=', userId).forUpdate().executeTakeFirstOrThrow();
  }

  findByKey(userId: string, kind: string, key: string, transaction: KondisTransaction) {
    return transaction
      .selectFrom('mcp_operation')
      .select(['id', 'input_hash', 'result'])
      .where('user_id', '=', userId)
      .where('kind', '=', kind)
      .where('idempotency_key', '=', key)
      .executeTakeFirst() as Promise<{ id: string; input_hash: string; result: McpOperationResult } | undefined>;
  }

  async record(
    input: {
      userId: string;
      credentialId: string | null;
      kind: string;
      key: string;
      inputHash: string;
      result: McpOperationResult;
    },
    transaction: KondisTransaction,
  ): Promise<string> {
    const operation = await transaction
      .insertInto('mcp_operation')
      .values({
        user_id: input.userId,
        credential_id: input.credentialId,
        kind: input.kind,
        idempotency_key: input.key,
        input_hash: input.inputHash,
        result: input.result,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto('mcp_audit')
      .values({
        user_id: input.userId,
        credential_id: input.credentialId,
        action: input.kind,
        target_id: input.result.activityId ?? input.result.uploadId ?? null,
      })
      .execute();
    return operation.id;
  }

  createStagedUpload(input: {
    id: string;
    userId: string;
    checksum: string;
    originalName: string;
    storagePath: string;
    byteSize: number;
    expiresAt: Date;
  }) {
    return this.db
      .insertInto('mcp_upload')
      .values({
        id: input.id,
        user_id: input.userId,
        checksum: input.checksum,
        original_name: input.originalName,
        storage_path: input.storagePath,
        byte_size: input.byteSize,
        expires_at: input.expiresAt,
        consumed_at: null,
      })
      .execute();
  }

  findStagedUpload(id: string, userId: string, transaction: KondisTransaction) {
    return transaction
      .selectFrom('mcp_upload')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('expires_at', '>', new Date())
      .forUpdate()
      .executeTakeFirst();
  }

  consumeStagedUpload(id: string, transaction: KondisTransaction) {
    return transaction.updateTable('mcp_upload').set({ consumed_at: new Date() }).where('id', '=', id).execute();
  }

  findKind(id: string, userId: string) {
    return this.db
      .selectFrom('mcp_operation')
      .select('kind')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }

  find(id: string, userId: string) {
    return this.db
      .selectFrom('mcp_operation')
      .select(['kind', 'result'])
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst() as Promise<{ kind: string; result: McpOperationResult } | undefined>;
  }

  findUploadStatus(id: string, userId: string) {
    return this.db
      .selectFrom('upload')
      .select(['status', 'error'])
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }

  async listActivityIds(uploadId: string, userId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('activity')
      .select('id')
      .where('upload_id', '=', uploadId)
      .where('user_id', '=', userId)
      .limit(100)
      .execute();
    return rows.map(({ id }) => id);
  }

  async deleteExpiredUploads(): Promise<void> {
    await sql`DELETE FROM mcp_upload WHERE expires_at <= now() - interval '1 day'`.execute(this.db);
  }
}
