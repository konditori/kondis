import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { DB } from 'src/db/schema';
import type { KondisDatabase } from 'src/types';

export type HyperdriveDatabase = {
  db: KondisDatabase;
  close: () => Promise<void>;
};

export const createHyperdriveDatabase = (connectionString: string, logTimings = false): HyperdriveDatabase => {
  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    log: logTimings
      ? (event) => {
          console.log('database.query', {
            operation: event.query.sql.trim().split(/\s+/)[0],
            relation: event.query.sql.match(/\b(?:from|into|update)\s+"?(\w+)/i)?.[1],
            durationMs: event.queryDurationMillis,
            level: event.level,
          });
        }
      : undefined,
  });

  return { db, close: () => db.destroy() };
};
