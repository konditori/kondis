import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { DB } from 'src/db/schema';
import type { KondisDatabase } from 'src/types';

export type HyperdriveDatabase = {
  db: KondisDatabase;
  close: () => Promise<void>;
};

/**
 * Create a short-lived Kysely database for one Worker invocation.
 */
export const createHyperdriveDatabase = (connectionString: string): HyperdriveDatabase => {
  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

  return { db, close: () => db.destroy() };
};
