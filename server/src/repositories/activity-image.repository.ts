import { Inject, Injectable } from '@nestjs/common';

import { KYSELY, KondisDatabase, KondisExecutor } from 'src/db/database';
import {
  ActivityImage,
  ActivityImageFile,
  ActivityImageUpdate,
  NewActivityImage,
  NewActivityImageFile,
} from 'src/db/schema';

@Injectable()
export class ActivityImageRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  create(input: NewActivityImage, executor: KondisExecutor = this.db): Promise<ActivityImage> {
    return executor.insertInto('activity_image').values(input).returningAll().executeTakeFirstOrThrow();
  }

  getById(id: string, userId?: string): Promise<ActivityImage | undefined> {
    return this.db
      .selectFrom('activity_image')
      .innerJoin('upload', 'upload.id', 'activity_image.upload_id')
      .selectAll('activity_image')
      .where('activity_image.id', '=', id)
      .$if(!!userId, (query) => query.where('upload.user_id', '=', userId!))
      .executeTakeFirst();
  }

  getByUploadChecksum(uploadId: string, checksum: string, executor: KondisExecutor = this.db) {
    return executor
      .selectFrom('activity_image')
      .selectAll()
      .where('upload_id', '=', uploadId)
      .where('checksum', '=', checksum)
      .executeTakeFirst();
  }

  listForUpload(uploadId: string, userId?: string) {
    return this.db
      .selectFrom('activity_image')
      .innerJoin('upload', 'upload.id', 'activity_image.upload_id')
      .selectAll('activity_image')
      .$if(!!userId, (query) => query.where('upload.user_id', '=', userId!))
      .where('activity_image.upload_id', '=', uploadId)
      .orderBy('activity_image.sort_order')
      .orderBy('activity_image.created_at')
      .execute();
  }

  async nextSortOrder(uploadId: string, executor: KondisExecutor = this.db): Promise<number> {
    const row = await executor
      .selectFrom('activity_image')
      .select(({ fn }) => fn.max('sort_order').as('sort_order'))
      .where('upload_id', '=', uploadId)
      .executeTakeFirstOrThrow();
    return (row.sort_order === null ? -1 : Number(row.sort_order)) + 1;
  }

  async getFiles(imageId: string, executor: KondisExecutor = this.db): Promise<ActivityImageFile[]> {
    return executor.selectFrom('activity_image_file').selectAll().where('image_id', '=', imageId).execute();
  }

  async upsertFile(input: NewActivityImageFile, executor: KondisExecutor = this.db): Promise<void> {
    await executor
      .insertInto('activity_image_file')
      .values(input)
      .onConflict((oc) => oc.columns(['image_id', 'variant']).doUpdateSet(input))
      .execute();
  }

  update(
    id: string,
    input: ActivityImageUpdate,
    executor: KondisExecutor = this.db,
  ): Promise<ActivityImage | undefined> {
    return executor.updateTable('activity_image').set(input).where('id', '=', id).returningAll().executeTakeFirst();
  }

  delete(id: string, executor: KondisExecutor = this.db): Promise<void> {
    return executor
      .deleteFrom('activity_image')
      .where('id', '=', id)
      .execute()
      .then(() => {});
  }

  listForThumbnailGeneration(force = false) {
    let query = this.db
      .selectFrom('activity_image')
      .select('id')
      .where('status', 'in', ['ready', 'failed'] as const);
    if (!force) {
      query = query.where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('activity_image_file')
              .select('image_id')
              .whereRef('image_id', '=', 'activity_image.id')
              .where('variant', '=', 'thumbnail'),
          ),
        ),
      );
    }
    return query.orderBy('id').execute();
  }
}
