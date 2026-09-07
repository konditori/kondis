import { sql } from 'kysely';

import type { KondisDatabase } from 'src/types';

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

/*
 * Durable checkpoints for browser-owned ZIP extraction.
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
    if (!progress) {
      return;
    }
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

  async registerItems(importId: string, userId: string, items: TakeoutImportItem[]): Promise<string[]> {
    const importRecord = await this.get(importId, userId);
    if (!importRecord || importRecord.status === 'cancelled') {
      return [];
    }
    if (items.length > 0) {
      await this.db
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
        .execute();
    }
    const total = await this.db
      .selectFrom('takeout_import_item')
      .select((expressionBuilder) => expressionBuilder.fn.countAll<number>().as('count'))
      .where('import_id', '=', importId)
      .executeTakeFirstOrThrow();
    await this.db
      .updateTable('takeout_import')
      .set({ total: Number(total.count), status: 'uploading', error: null })
      .where('id', '=', importId)
      .where('user_id', '=', userId)
      .where('status', 'not in', ['cancelled', 'completed'])
      .execute();
    const pending = await this.db
      .selectFrom('takeout_import_item')
      .select('item_key')
      .where('import_id', '=', importId)
      .where('status', 'in', ['pending', 'uploading'])
      .execute();
    return pending.map(({ item_key }) => item_key);
  }

  async beginItem(importId: string, userId: string, itemKey: string, kind: TakeoutImportItemKind): Promise<boolean> {
    const result = await this.db
      .updateTable('takeout_import_item')
      .set({ status: 'uploading', error: null })
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .where('kind', '=', kind)
      .where('status', 'in', ['pending', 'uploading'])
      .where(
        'import_id',
        'in',
        this.db
          .selectFrom('takeout_import')
          .select('id')
          .where('id', '=', importId)
          .where('user_id', '=', userId)
          .where('status', 'in', ['scanning', 'uploading', 'processing']),
      )
      .returning('item_key')
      .executeTakeFirst();
    return Boolean(result);
  }

  async markQueued(importId: string, itemKey: string): Promise<void> {
    await this.db
      .updateTable('takeout_import_item')
      .set({ status: 'queued', error: null })
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .where('status', '=', 'uploading')
      .execute();
    await this.sync(importId);
  }

  async completeItem(
    importId: string,
    itemKey: string,
    status: Extract<TakeoutImportItemStatus, 'completed' | 'failed' | 'duplicate'>,
    error?: string,
  ): Promise<void> {
    await this.db
      .updateTable('takeout_import_item')
      .set({ status, ...(error && { error }) })
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .where('status', 'not in', terminalItemStates)
      .execute();
    await this.sync(importId);
  }

  async failItem(importId: string, userId: string, itemKey: string, error: string): Promise<boolean> {
    const owner = await this.get(importId, userId);
    if (!owner || owner.status === 'cancelled') {
      return false;
    }
    const result = await this.db
      .updateTable('takeout_import_item')
      .set({ status: 'failed', error })
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .where('status', 'not in', terminalItemStates)
      .returning('item_key')
      .executeTakeFirst();
    if (result) {
      await this.sync(importId);
    }
    return Boolean(result);
  }

  async finalize(importId: string, userId: string, extractionErrors = 0): Promise<ImportProgress | undefined> {
    const message = extractionErrors > 0 ? `${extractionErrors} archive entries could not be extracted` : null;
    await this.db
      .updateTable('takeout_import')
      .set({ status: 'processing', ...(message && { error: message }) })
      .where('id', '=', importId)
      .where('user_id', '=', userId)
      .where('status', 'in', ['scanning', 'uploading', 'processing'])
      .execute();
    await this.sync(importId);
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

  private async sync(importId: string): Promise<void> {
    const counts = await this.db
      .selectFrom('takeout_import_item')
      .select([
        sql<number>`count(*) filter (where status <> 'pending')`.as('uploaded'),
        sql<number>`count(*) filter (where status in ('completed', 'failed', 'duplicate'))`.as('processed'),
        sql<number>`count(*) filter (where status = 'failed')`.as('failed'),
        sql<number>`count(*) filter (where status = 'duplicate')`.as('duplicates'),
      ])
      .where('import_id', '=', importId)
      .executeTakeFirstOrThrow();
    await this.db
      .updateTable('takeout_import')
      .set({
        uploaded: Number(counts.uploaded),
        processed: Number(counts.processed),
        failed: Number(counts.failed),
        duplicates: Number(counts.duplicates),
        status: sql<ImportProgressStatus>`CASE
          WHEN status = 'processing' AND ${Number(counts.processed)} >= COALESCE(total, 0) THEN 'completed'
          ELSE status
        END`,
      })
      .where('id', '=', importId)
      .where('status', 'not in', ['cancelled', 'failed', 'completed'])
      .execute();
  }
}
