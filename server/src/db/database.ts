import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { DB } from 'src/db/schema';
import type { DatabaseConfig, KondisDatabase } from 'src/types';

let typeParsersConfigured = false;

const configureTypeParsers = (): void => {
  if (typeParsersConfigured) {
    return;
  }
  pg.types.setTypeParser(pg.types.builtins.INT8, Number);
  typeParsersConfigured = true;
};

export const createDatabase = (config: DatabaseConfig): KondisDatabase => {
  configureTypeParsers();

  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: 10,
  });

  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
};
