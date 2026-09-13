import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import { configureTypeParsers } from 'src/db/database';
import type { DB } from 'src/db/schema';

export type HyperdriveDatabase = {
  db: Kysely<DB>;
  close: () => Promise<void>;
};

export const createHyperdriveDatabase = (connectionString: string): HyperdriveDatabase => {
  configureTypeParsers();
  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  });

  return { db, close: () => db.destroy() };
};
