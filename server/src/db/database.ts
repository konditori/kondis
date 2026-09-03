import { Inject, Injectable, Logger, OnApplicationShutdown, Provider } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import { ConfigRepository } from 'src/repositories/config.repository';
import type { DatabaseConfig, KondisDatabase } from 'src/types';
import type { DB } from 'src/db/schema';

export const KYSELY = Symbol('KYSELY');

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

export const databaseProvider: Provider = {
  provide: KYSELY,
  inject: [ConfigRepository],
  useFactory: (config: ConfigRepository): KondisDatabase => createDatabase(config.getEnv().database),
};

@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseLifecycle.name);

  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Closing database pool');
    await this.db.destroy();
  }
}
