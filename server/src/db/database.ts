import { Inject, Injectable, Logger, OnApplicationShutdown, Provider } from '@nestjs/common';
import { Kysely, PostgresDialect, Transaction } from 'kysely';
import { Migrator } from 'kysely/migration';
import pg from 'pg';

import { ConfigService, DatabaseConfig } from 'src/config/config.service';
import { StaticMigrationProvider } from 'src/db/migrations';
import { DB } from 'src/db/schema';

export const KYSELY = Symbol('KYSELY');

export type KondisDatabase = Kysely<DB>;
export type KondisTransaction = Transaction<DB>;

export type KondisExecutor = KondisDatabase | KondisTransaction;

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

export const createMigrator = (db: KondisDatabase): Migrator =>
  new Migrator({ db, provider: new StaticMigrationProvider() });

export const databaseProvider: Provider = {
  provide: KYSELY,
  inject: [ConfigService],
  useFactory: (config: ConfigService): KondisDatabase => createDatabase(config.database),
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
