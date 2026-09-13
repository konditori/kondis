import {
  ActivityImage,
  ActivityImageFile,
  ActivityImageUpdate,
  NewActivityImage,
  NewActivityImageFile,
} from 'src/db/schema';
import type { KondisDatabase, KondisExecutor } from 'src/types';

export class MediaRepository {
  constructor(private readonly db: KondisDatabase) {}

  create(input: NewActivityImage, executor: KondisExecutor = this.db): Promise<ActivityImage> {
    return executor.insertInto('activity_image').values(input).returningAll().executeTakeFirstOrThrow();
  }

  getById(id: string, userId?: string): Promise<ActivityImage | undefined> {
    return this.db
      .selectFrom('activity_image')
      .innerJoin('activity', 'activity.id', 'activity_image.activity_id')
      .selectAll('activity_image')
      .where('activity_image.id', '=', id)
      .$if(!!userId, (query) => query.where('activity.user_id', '=', userId!))
      .executeTakeFirst();
  }

  getByActivityChecksum(activityId: string, checksum: string, executor: KondisExecutor = this.db) {
    return executor
      .selectFrom('activity_image')
      .selectAll()
      .where('activity_id', '=', activityId)
      .where('checksum', '=', checksum)
      .executeTakeFirst();
  }

  listForActivity(activityId: string, userId?: string) {
    return this.db
      .selectFrom('activity_image')
      .innerJoin('activity', 'activity.id', 'activity_image.activity_id')
      .selectAll('activity_image')
      .$if(!!userId, (query) => query.where('activity.user_id', '=', userId!))
      .where('activity_image.activity_id', '=', activityId)
      .orderBy('activity_image.sort_order')
      .orderBy('activity_image.created_at')
      .execute();
  }

  async nextSortOrder(activityId: string, executor: KondisExecutor = this.db): Promise<number> {
    const row = await executor
      .selectFrom('activity_image')
      .select(({ fn }) => fn.max('sort_order').as('sort_order'))
      .where('activity_id', '=', activityId)
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
