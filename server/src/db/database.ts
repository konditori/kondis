import { Inject, Injectable, Logger, OnApplicationShutdown, Provider } from '@nestjs/common';
import { Kysely, Migrator, PostgresDialect } from 'kysely';
import pg from 'pg';

import { ConfigService, DatabaseConfig } from 'src/config/config.service';
import { StaticMigrationProvider } from 'src/db/migrations';
import { DB } from 'src/db/schema';

/** DI token for the Kysely instance. Inject with `@Inject(KYSELY)`. */
export const KYSELY = Symbol('KYSELY');

export type KondisDatabase = Kysely<DB>;

let typeParsersConfigured = false;

/**
 * node-postgres returns bigint (int8) as a string to avoid precision loss. Every int8 in
 * this schema is a byte count that comfortably fits in a JS number, so parse it eagerly and
 * keep `number` types honest end to end.
 */
const configureTypeParsers = (): void => {
  if (typeParsersConfigured) {
    return;
  }
  pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));
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

/** Closes the pool on SIGTERM so in-flight queries drain instead of being severed. */
@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseLifecycle.name);

  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Closing database pool');
    await this.db.destroy();
  }
}
