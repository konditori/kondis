import { Inject, Injectable } from '@nestjs/common';

import { KYSELY, KondisDatabase, KondisExecutor } from 'src/db/database';
import { NewUpload, Upload, UploadStatus } from 'src/db/schema';

export type UploadPageOptions = {
  /** Include uploads that already produced an activity. */
  force: boolean;
  /** Keyset cursor: the last id of the previous page. */
  after?: string;
  limit: number;
};

@Injectable()
export class UploadRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  create(upload: NewUpload, executor: KondisExecutor = this.db): Promise<Upload> {
    return executor.insertInto('upload').values(upload).returningAll().executeTakeFirstOrThrow();
  }

  getById(id: string): Promise<Upload | undefined> {
    return this.db.selectFrom('upload').selectAll().where('id', '=', id).executeTakeFirst();
  }

  getByChecksum(checksum: string): Promise<Upload | undefined> {
    return this.db.selectFrom('upload').selectAll().where('checksum', '=', checksum).executeTakeFirst();
  }

  async setStatus(id: string, status: UploadStatus, error: string | null = null): Promise<void> {
    await this.db.updateTable('upload').set({ status, error }).where('id', '=', id).execute();
  }

  /** Deleting an upload cascades to its activity, streams and laps. */
  async delete(id: string, executor: KondisExecutor = this.db): Promise<void> {
    await executor.deleteFrom('upload').where('id', '=', id).execute();
  }

  /**
   * One page of upload ids for the parse fan-out.
   *
   * Keyset pagination on the primary key rather than `OFFSET`: the fan-out enqueues jobs that
   * concurrently mutate the rows it is scanning, and an offset walk over a shifting result set
   * silently skips rows. Ordering by `id` is arbitrary but stable and unique, which is all a
   * cursor needs.
   */
  async getIdsToParse({ force, after, limit }: UploadPageOptions): Promise<string[]> {
    let query = this.db.selectFrom('upload').select('upload.id').orderBy('upload.id').limit(limit);

    if (after) {
      query = query.where('upload.id', '>', after);
    }

    if (!force) {
      // Anything that never became an activity: a parse that failed, or one that was never run.
      query = query.where(({ not, exists, selectFrom }) =>
        not(exists(selectFrom('activity').select('activity.id').whereRef('activity.upload_id', '=', 'upload.id'))),
      );
    }

    const rows = await query.execute();
    return rows.map(({ id }) => id);
  }
}
