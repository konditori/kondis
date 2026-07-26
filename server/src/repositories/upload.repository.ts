import { Inject, Injectable } from '@nestjs/common';

import { KYSELY, KondisDatabase } from 'src/db/database';
import { NewUpload, Upload, UploadStatus } from 'src/db/schema';

@Injectable()
export class UploadRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  create(upload: NewUpload): Promise<Upload> {
    return this.db.insertInto('upload').values(upload).returningAll().executeTakeFirstOrThrow();
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
}
