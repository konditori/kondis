import { Inject, Injectable } from '@nestjs/common';

import { KYSELY, KondisDatabase, KondisTransaction } from 'src/db/database';

@Injectable()
export class DatabaseRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  /**
   * Run several repository calls, and any job enqueues, as one atomic unit.
   *
   * Owning the transaction here rather than inside a single repository is what lets a service
   * express "this row and the job about it either both exist or neither does" without any
   * repository knowing about queues.
   */
  withTransaction<T>(fn: (trx: KondisTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(fn);
  }
}
