import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';

import { KYSELY, KondisDatabase, KondisTransaction } from 'src/db/database';
import type { RealtimeEvent } from 'src/types';

export const REALTIME_CHANNEL = 'kondis_realtime';

@Injectable()
export class DatabaseRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  withTransaction<T>(fn: (trx: KondisTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(fn);
  }

  async publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
    await sql`SELECT pg_notify(${REALTIME_CHANNEL}, ${JSON.stringify(event)})`.execute(this.db);
  }
}
