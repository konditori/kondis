import { sql } from 'kysely';

import type { KondisDatabase } from 'src/types';

export type ImportProgressStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type ImportProgress = {
  importId: string;
  userId: string;
  status: ImportProgressStatus;
  total: number | null;
  processed: number;
  failed: number;
  duplicates: number;
  error: string | null;
};

export class ImportProgressStore {
  constructor(private readonly db: KondisDatabase) {}

  async create(importId: string, userId: string): Promise<void> {
    await this.db.insertInto('takeout_import').values({ id: importId, user_id: userId }).execute();
  }

  async get(importId: string, userId: string): Promise<ImportProgress | undefined> {
    const progress = await this.db
      .selectFrom('takeout_import')
      .select(['id', 'user_id', 'status', 'total', 'processed', 'failed', 'duplicates', 'error'])
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
      processed: progress.processed,
      failed: progress.failed,
      duplicates: progress.duplicates,
      error: progress.error,
    };
  }

  async setProcessing(importId: string, total: number): Promise<void> {
    await this.db
      .updateTable('takeout_import')
      .set({
        total,
        status: sql<ImportProgressStatus>`CASE WHEN processed >= ${total} THEN 'completed' ELSE 'processing' END`,
      })
      .where('id', '=', importId)
      .execute();
  }

  async increment(importId: string, failed = false, duplicate = false): Promise<void> {
    await this.db
      .updateTable('takeout_import')
      .set({
        processed: sql`processed + 1`,
        ...(failed && { failed: sql`failed + 1` }),
        ...(duplicate && { duplicates: sql`duplicates + 1` }),
        status: sql`CASE
          WHEN status = 'failed' THEN status
          WHEN total IS NOT NULL AND processed + 1 >= total THEN 'completed'
          ELSE status
        END`,
      })
      .where('id', '=', importId)
      .execute();
  }

  async fail(importId: string, error: string): Promise<void> {
    await this.db.updateTable('takeout_import').set({ status: 'failed', error }).where('id', '=', importId).execute();
  }
}
