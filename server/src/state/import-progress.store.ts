import { sql } from 'kysely';

import type { KondisDatabase, KondisTransaction } from 'src/types';

export type ImportProgressStatus = 'scanning' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TakeoutImportItemKind = 'activity' | 'manual';
export type TakeoutImportItemStatus = 'pending' | 'uploading' | 'queued' | 'completed' | 'failed' | 'duplicate';

export type ImportProgress = {
  importId: string;
  userId: string;
  status: ImportProgressStatus;
  total: number | null;
  uploaded: number;
  processed: number;
  failed: number;
  duplicates: number;
  error: string | null;
};

export type TakeoutImportItem = {
  itemKey: string;
  kind: TakeoutImportItemKind;
  metadata: unknown;
};

const terminalItemStates: TakeoutImportItemStatus[] = ['completed', 'failed', 'duplicate'];
const isTerminal = (status: TakeoutImportItemStatus): boolean => terminalItemStates.includes(status);

type ItemTransition = {
  uploaded: number;
  processed: number;
  failed: number;
  duplicates: number;
};

const transitionDeltas = (from: TakeoutImportItemStatus, to: TakeoutImportItemStatus): ItemTransition => ({
  uploaded: from === 'pending' && to !== 'pending' ? 1 : 0,
  processed: Number(isTerminal(to)) - Number(isTerminal(from)),
  failed: Number(to === 'failed') - Number(from === 'failed'),
  duplicates: Number(to === 'duplicate') - Number(from === 'duplicate'),
});

/*
 * Durable checkpoints for browser-owned ZIP extraction.
 *
 * Item transitions and denormalized counters are updated in the same
 * transaction. This avoids an aggregate scan per item and makes concurrent
 * uploads and retry-success transitions monotonic.
 */
export class ImportProgressStore {
  constructor(private readonly db: KondisDatabase) {}

  async create(importId: string, userId: string, status: ImportProgressStatus = 'scanning'): Promise<void> {
    await this.db.insertInto('takeout_import').values({ id: importId, user_id: userId, status }).execute();
  }

  async get(importId: string, userId: string): Promise<ImportProgress | undefined> {
    const progress = await this.db
      .selectFrom('takeout_import')
      .select(['id', 'user_id', 'status', 'total', 'uploaded', 'processed', 'failed', 'duplicates', 'error'])
      .where('id', '=', importId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return progress && this.toProgress(progress);
  }

  async registerItems(importId: string, userId: string, items: TakeoutImportItem[]): Promise<string[]> {
    return this.db.transaction().execute(async (trx) => {
      const importRecord = await this.lockImport(trx, importId, userId);
      if (!importRecord || importRecord.status === 'cancelled') {
        return [];
      }

      await sql`
        WITH recovered AS (
          UPDATE takeout_import_item
          SET status = 'pending', error = NULL
          WHERE import_id = ${importId}
            AND status = 'uploading'
          RETURNING 1
        )
        UPDATE takeout_import
        SET uploaded = GREATEST(0, uploaded - (SELECT count(*) FROM recovered))
        WHERE id = ${importId}
      `.execute(trx);

      const inserted =
        items.length === 0
          ? []
          : await trx
              .insertInto('takeout_import_item')
              .values(
                items.map((item) => ({
                  import_id: importId,
                  item_key: item.itemKey,
                  kind: item.kind,
                  metadata: item.metadata,
                })),
              )
              .onConflict((conflict) => conflict.columns(['import_id', 'item_key']).doNothing())
              .returning('item_key')
              .execute();

      await trx
        .updateTable('takeout_import')
        .set({
          total: sql<number>`COALESCE(total, 0) + ${inserted.length}`,
          status: 'uploading',
          error: null,
        })
        .where('id', '=', importId)
        .where('status', 'not in', ['cancelled', 'completed'])
        .execute();

      const pending = await trx
        .selectFrom('takeout_import_item')
        .select('item_key')
        .where('import_id', '=', importId)
        .where('status', 'in', ['pending', 'uploading'])
        .execute();
      return pending.map(({ item_key }) => item_key);
    });
  }

  async beginItem(importId: string, userId: string, itemKey: string, kind: TakeoutImportItemKind): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const owner = await this.lockImport(trx, importId, userId);
      if (!owner || owner.status === 'cancelled' || owner.status === 'completed') {
        return false;
      }
      const item = await trx
        .selectFrom('takeout_import_item')
        .select(['status'])
        .where('import_id', '=', importId)
        .where('item_key', '=', itemKey)
        .where('kind', '=', kind)
        .forUpdate()
        .executeTakeFirst();
      // `uploading` is an in-flight claim. Only a fresh item or a previous
      // failed attempt may be claimed again; this makes duplicate browser
      // submissions harmless.
      if (!item || !['pending', 'failed'].includes(item.status)) {
        return false;
      }

      const delta = transitionDeltas(item.status, 'uploading');
      await trx
        .updateTable('takeout_import_item')
        .set({ status: 'uploading', error: null })
        .where('import_id', '=', importId)
        .where('item_key', '=', itemKey)
        .execute();
      await this.applyDeltas(trx, importId, delta);
      return true;
    });
  }

  async markQueued(importId: string, itemKey: string): Promise<void> {
    await this.db
      .updateTable('takeout_import_item')
      .set({ status: 'queued', error: null })
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .where('status', '=', 'uploading')
      .execute();
  }

  async completeItem(
    importId: string,
    itemKey: string,
    status: Extract<TakeoutImportItemStatus, 'completed' | 'failed' | 'duplicate'>,
    error?: string,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await this.transitionItemWithExecutor(trx, importId, itemKey, status, error);
    });
  }

  async failItem(importId: string, userId: string, itemKey: string, error: string): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const owner = await this.lockImport(trx, importId, userId);
      if (!owner || owner.status === 'cancelled') {
        return false;
      }
      return this.transitionItemWithExecutor(trx, importId, itemKey, 'failed', error);
    });
  }

  /** Marks a queued job's item failed when the job has exhausted its retries. */
  async failJobItem(importId: string, itemKey: string, error: string): Promise<boolean> {
    return this.db
      .transaction()
      .execute((trx) => this.transitionItemWithExecutor(trx, importId, itemKey, 'failed', error));
  }

  async finalize(importId: string, userId: string, extractionErrors = 0): Promise<ImportProgress | undefined> {
    const message = extractionErrors > 0 ? `${extractionErrors} archive entries could not be extracted` : null;
    await this.db.transaction().execute(async (trx) => {
      const owner = await this.lockImport(trx, importId, userId);
      if (!owner || ['cancelled', 'completed'].includes(owner.status)) {
        return;
      }
      await trx
        .updateTable('takeout_import')
        .set({ status: 'processing', ...(message && { error: message }) })
        .where('id', '=', importId)
        .execute();
      await this.completeIfReady(trx, importId);
    });
    return this.get(importId, userId);
  }

  async cancel(importId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('takeout_import')
      .set({ status: 'cancelled' })
      .where('id', '=', importId)
      .where('user_id', '=', userId)
      .where('status', 'not in', ['completed', 'cancelled'])
      .returning('id')
      .executeTakeFirst();
    return Boolean(result);
  }

  private async transitionItemWithExecutor(
    trx: KondisTransaction,
    importId: string,
    itemKey: string,
    status: Extract<TakeoutImportItemStatus, 'completed' | 'failed' | 'duplicate'>,
    error?: string,
  ): Promise<boolean> {
    const item = await trx
      .selectFrom('takeout_import_item')
      .select('status')
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .forUpdate()
      .executeTakeFirst();
    if (!item || (isTerminal(item.status) && !(item.status === 'failed' && status !== 'failed'))) {
      return false;
    }

    const delta = transitionDeltas(item.status, status);
    await trx
      .updateTable('takeout_import_item')
      .set({ status, error: status === 'failed' ? (error ?? null) : null })
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .execute();
    await this.applyDeltas(trx, importId, delta);
    return true;
  }

  private async applyDeltas(trx: KondisTransaction, importId: string, delta: ItemTransition): Promise<void> {
    if (!delta.uploaded && !delta.processed && !delta.failed && !delta.duplicates) {
      return;
    }
    await trx
      .updateTable('takeout_import')
      .set({
        uploaded: sql<number>`uploaded + ${delta.uploaded}`,
        processed: sql<number>`processed + ${delta.processed}`,
        failed: sql<number>`failed + ${delta.failed}`,
        duplicates: sql<number>`duplicates + ${delta.duplicates}`,
      })
      .where('id', '=', importId)
      .execute();
    await this.completeIfReady(trx, importId);
  }

  private async completeIfReady(trx: KondisTransaction, importId: string): Promise<void> {
    await trx
      .updateTable('takeout_import')
      .set({
        status: sql<ImportProgressStatus>`CASE
          WHEN status = 'processing' AND processed >= COALESCE(total, 0) THEN 'completed'
          ELSE status
        END`,
      })
      .where('id', '=', importId)
      .where('status', 'not in', ['cancelled', 'failed', 'completed'])
      .execute();
  }

  private lockImport(trx: KondisTransaction, importId: string, userId: string) {
    return trx
      .selectFrom('takeout_import')
      .select(['id', 'status'])
      .where('id', '=', importId)
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
  }

  private toProgress(progress: {
    id: string;
    user_id: string;
    status: ImportProgressStatus;
    total: number | null;
    uploaded: number;
    processed: number;
    failed: number;
    duplicates: number;
    error: string | null;
  }): ImportProgress {
    return {
      importId: progress.id,
      userId: progress.user_id,
      status: progress.status,
      total: progress.total,
      uploaded: progress.uploaded,
      processed: progress.processed,
      failed: progress.failed,
      duplicates: progress.duplicates,
      error: progress.error,
    };
  }
}
