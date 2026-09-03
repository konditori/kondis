import { Inject, Injectable } from '@nestjs/common';

import { KYSELY } from 'src/db/database';
import { NewUpload, Upload, UploadStatus } from 'src/db/schema';
import type { ActivityType, KondisDatabase, KondisExecutor } from 'src/types';

type UploadPageOptions = {
  force: boolean;
  after?: string;
  limit: number;
};

type ManualActivitySignature = {
  startedAt: Date;
  sport: ActivityType;
  elapsedTime: number;
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

  getByChecksum(checksum: string, userId?: string): Promise<Upload | undefined> {
    let query = this.db.selectFrom('upload').selectAll().where('checksum', '=', checksum);
    if (userId) {
      query = query.where('user_id', '=', userId);
    }
    return query.executeTakeFirst();
  }

  async hasManualActivity(signature: ManualActivitySignature, userId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('upload')
      .innerJoin('activity', 'activity.upload_id', 'upload.id')
      .innerJoin('activity_metric', 'activity_metric.activity_id', 'activity.id')
      .select('upload.id')
      .where('upload.user_id', '=', userId)
      .where('upload.original_name', '=', 'Strava manual activity')
      .where('activity.started_at', '=', signature.startedAt)
      .where('activity.sport', '=', signature.sport)
      .where('activity_metric.elapsed_time', '=', signature.elapsedTime)
      .executeTakeFirst();
    return row !== undefined;
  }

  async setStatus(id: string, status: UploadStatus, error: string | null = null): Promise<void> {
    await this.db.updateTable('upload').set({ status, error }).where('id', '=', id).execute();
  }

  async delete(id: string, executor: KondisExecutor = this.db): Promise<void> {
    await executor.deleteFrom('upload').where('id', '=', id).execute();
  }

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
