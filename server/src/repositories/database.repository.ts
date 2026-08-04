import { Inject, Injectable } from '@nestjs/common';

import { KYSELY, KondisDatabase, KondisTransaction } from 'src/db/database';

@Injectable()
export class DatabaseRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  withTransaction<T>(fn: (trx: KondisTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(fn);
  }
}
