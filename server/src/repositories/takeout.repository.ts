import { sql } from 'kysely';

import {
  ImportProgressStatus as ImportProgressStatusEnum,
  TakeoutImportItemKind,
  TakeoutImportItemStatus,
  TakeoutImportItemTerminalStatus,
} from 'src/enum';
import type {
  ImportProgress,
  ImportProgressStatus,
  ItemTransition,
  KondisDatabase,
  KondisTransaction,
  TakeoutImportItem,
} from 'src/types';
import type { IActivityImageStage } from 'src/types/jobs';

const terminalItemStates: Set<TakeoutImportItemStatus> = new Set([
  TakeoutImportItemStatus.Completed,
  TakeoutImportItemStatus.Failed,
  TakeoutImportItemStatus.Duplicate,
]);
const activeImportStates: Set<ImportProgressStatus> = new Set([
  ImportProgressStatusEnum.Cancelled,
  ImportProgressStatusEnum.Completed,
]);
const pendingItemStates: Set<TakeoutImportItemStatus> = new Set([
  TakeoutImportItemStatus.Pending,
  TakeoutImportItemStatus.Failed,
]);
const isTerminal = (status: TakeoutImportItemStatus): boolean => terminalItemStates.has(status);

const toItemStatus = (status: TakeoutImportItemTerminalStatus): TakeoutImportItemStatus => {
  switch (status) {
    case TakeoutImportItemTerminalStatus.Completed: {
      return TakeoutImportItemStatus.Completed;
    }
    case TakeoutImportItemTerminalStatus.Failed: {
      return TakeoutImportItemStatus.Failed;
    }
    case TakeoutImportItemTerminalStatus.Duplicate: {
      return TakeoutImportItemStatus.Duplicate;
    }
  }
};

const transitionDeltas = (from: TakeoutImportItemStatus, to: TakeoutImportItemStatus): ItemTransition => ({
  uploaded: from === TakeoutImportItemStatus.Pending && to !== TakeoutImportItemStatus.Pending ? 1 : 0,
  processed: Number(isTerminal(to)) - Number(isTerminal(from)),
  failed: Number(to === TakeoutImportItemStatus.Failed) - Number(from === TakeoutImportItemStatus.Failed),
  duplicates: Number(to === TakeoutImportItemStatus.Duplicate) - Number(from === TakeoutImportItemStatus.Duplicate),
});

export class TakeoutRepository {
  constructor(private readonly db: KondisDatabase) {}

  async create(
    importId: string,
    userId: string,
    status: ImportProgressStatus = ImportProgressStatusEnum.Scanning,
  ): Promise<void> {
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
      if (!importRecord || activeImportStates.has(importRecord.status)) {
        return [];
      }

      await sql`
        WITH recovered AS (
          UPDATE takeout_import_item
          SET status = ${TakeoutImportItemStatus.Pending}, error = NULL
          WHERE import_id = ${importId}
            AND status = ${TakeoutImportItemStatus.Uploading}
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
          status: ImportProgressStatusEnum.Uploading,
          error: null,
        })
        .where('id', '=', importId)
        .where('status', 'not in', [ImportProgressStatusEnum.Cancelled, ImportProgressStatusEnum.Completed])
        .execute();

      const pending = await trx
        .selectFrom('takeout_import_item')
        .select('item_key')
        .where('import_id', '=', importId)
        .where('status', 'in', [TakeoutImportItemStatus.Pending, TakeoutImportItemStatus.Uploading])
        .execute();
      return pending.map(({ item_key }) => item_key);
    });
  }

  async beginItem(importId: string, userId: string, itemKey: string, kind: TakeoutImportItemKind): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const owner = await this.lockImport(trx, importId, userId);
      if (!owner || activeImportStates.has(owner.status)) {
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

      if (!item || !pendingItemStates.has(item.status as TakeoutImportItemStatus)) {
        return false;
      }

      const delta = transitionDeltas(item.status as TakeoutImportItemStatus, TakeoutImportItemStatus.Uploading);
      await trx
        .updateTable('takeout_import_item')
        .set({ status: TakeoutImportItemStatus.Uploading, error: null })
        .where('import_id', '=', importId)
        .where('item_key', '=', itemKey)
        .execute();
      await this.applyDeltas(trx, importId, delta);
      return true;
    });
  }

  async stagePhoto(
    importId: string,
    userId: string,
    itemKey: string,
    photo: IActivityImageStage & { photoKey: string },
  ): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const owner = await this.lockImport(trx, importId, userId);
      if (!owner || activeImportStates.has(owner.status)) {
        return false;
      }
      const item = await trx
        .selectFrom('takeout_import_item')
        .select(['status', 'staged_images'])
        .where('import_id', '=', importId)
        .where('item_key', '=', itemKey)
        .forUpdate()
        .executeTakeFirst();
      if (!item || !pendingItemStates.has(item.status as TakeoutImportItemStatus)) {
        return false;
      }
      const photos = item.staged_images.filter((image) => image.photoKey !== photo.photoKey);
      if (photos.length >= 100) {
        return false;
      }
      photos.push(photo);
      await trx
        .updateTable('takeout_import_item')
        .set({ staged_images: sql`${JSON.stringify(photos)}::jsonb` })
        .where('import_id', '=', importId)
        .where('item_key', '=', itemKey)
        .execute();
      return true;
    });
  }

  async getStagedPhotos(importId: string, userId: string, itemKey: string): Promise<IActivityImageStage[]> {
    const item = await this.db
      .selectFrom('takeout_import_item as item')
      .innerJoin('takeout_import as parent', 'parent.id', 'item.import_id')
      .select('item.staged_images')
      .where('parent.id', '=', importId)
      .where('parent.user_id', '=', userId)
      .where('item.item_key', '=', itemKey)
      .executeTakeFirst();
    return item?.staged_images ?? [];
  }

  async markQueued(importId: string, itemKey: string): Promise<void> {
    await this.db
      .updateTable('takeout_import_item')
      .set({ status: TakeoutImportItemStatus.Queued, error: null })
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .where('status', '=', TakeoutImportItemStatus.Uploading)
      .execute();
  }

  async completeItem(
    importId: string,
    itemKey: string,
    status: TakeoutImportItemTerminalStatus,
    error?: string,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await this.transitionItemWithExecutor(trx, importId, itemKey, status, error);
    });
  }

  async failItem(importId: string, userId: string, itemKey: string, error: string): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const owner = await this.lockImport(trx, importId, userId);
      if (!owner || owner.status === ImportProgressStatusEnum.Cancelled) {
        return false;
      }
      return this.transitionItemWithExecutor(trx, importId, itemKey, TakeoutImportItemTerminalStatus.Failed, error);
    });
  }

  async failJobItem(importId: string, itemKey: string, error: string): Promise<boolean> {
    return this.db
      .transaction()
      .execute((trx) =>
        this.transitionItemWithExecutor(trx, importId, itemKey, TakeoutImportItemTerminalStatus.Failed, error),
      );
  }

  async finalize(importId: string, userId: string, extractionErrors = 0): Promise<ImportProgress | undefined> {
    const message = extractionErrors > 0 ? `${extractionErrors} archive entries could not be extracted` : null;
    await this.db.transaction().execute(async (trx) => {
      const owner = await this.lockImport(trx, importId, userId);
      if (!owner || activeImportStates.has(owner.status)) {
        return;
      }
      await trx
        .updateTable('takeout_import')
        .set({ status: ImportProgressStatusEnum.Processing, ...(message && { error: message }) })
        .where('id', '=', importId)
        .execute();
      await this.completeIfReady(trx, importId);
    });
    return this.get(importId, userId);
  }

  async cancel(importId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('takeout_import')
      .set({ status: ImportProgressStatusEnum.Cancelled })
      .where('id', '=', importId)
      .where('user_id', '=', userId)
      .where('status', 'not in', [ImportProgressStatusEnum.Completed, ImportProgressStatusEnum.Cancelled])
      .returning('id')
      .executeTakeFirst();
    return Boolean(result);
  }

  private async transitionItemWithExecutor(
    trx: KondisTransaction,
    importId: string,
    itemKey: string,
    status: TakeoutImportItemTerminalStatus,
    error?: string,
  ): Promise<boolean> {
    const item = await trx
      .selectFrom('takeout_import_item')
      .select('status')
      .where('import_id', '=', importId)
      .where('item_key', '=', itemKey)
      .forUpdate()
      .executeTakeFirst();
    if (
      !item ||
      (isTerminal(item.status as TakeoutImportItemStatus) &&
        (item.status !== TakeoutImportItemStatus.Failed || status === TakeoutImportItemTerminalStatus.Failed))
    ) {
      return false;
    }

    const delta = transitionDeltas(item.status as TakeoutImportItemStatus, toItemStatus(status));
    await trx
      .updateTable('takeout_import_item')
      .set({
        status: toItemStatus(status),
        error: status === TakeoutImportItemTerminalStatus.Failed ? (error ?? null) : null,
      })
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
          WHEN status = ${ImportProgressStatusEnum.Processing} AND processed >= COALESCE(total, 0)
            THEN ${ImportProgressStatusEnum.Completed}
          ELSE status
        END`,
      })
      .where('id', '=', importId)
      .where('status', 'not in', [
        ImportProgressStatusEnum.Cancelled,
        ImportProgressStatusEnum.Failed,
        ImportProgressStatusEnum.Completed,
      ])
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
