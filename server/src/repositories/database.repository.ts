import { Inject, Injectable, Logger } from '@nestjs/common';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { DatabaseConfig } from 'src/repositories/config.repository';
import { createDatabase, KondisDatabase, KondisTransaction, KYSELY } from 'src/db/database';

// File migrations are loaded from this module's source/compiled sibling directory.
const MIGRATION_FOLDER = join(import.meta.dirname, '..', 'schema', 'migrations');

@Injectable()
export class DatabaseRepository {
  private readonly logger = new Logger(DatabaseRepository.name);

  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  withTransaction<T>(fn: (trx: KondisTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(fn);
  }

  async runMigrations(): Promise<void> {
    this.logger.log('Running migrations');
    const { error, results } = await this.createMigrator().migrateToLatest();
    this.logMigrationResults(results);

    if (error) {
      this.logger.error('Migrations failed', error instanceof Error ? error.stack : String(error));
      throw error;
    }

    this.logger.log('Finished running migrations');
  }

  async revertLastMigration(): Promise<string | undefined> {
    this.logger.log('Reverting the latest migration');
    const { error, results } = await this.createMigrator().migrateDown();
    this.logMigrationResults(results);

    if (error) {
      this.logger.error('Migration revert failed', error instanceof Error ? error.stack : String(error));
      throw error;
    }

    return results?.find((result) => result.direction === 'Down' && result.status === 'Success')?.migrationName;
  }

  private logMigrationResults(results: Awaited<ReturnType<Migrator['migrateToLatest']>>['results']): void {
    for (const result of results ?? []) {
      const message = `Migration "${result.migrationName}" ${result.direction.toLowerCase()}`;
      if (result.status === 'Success') {
        this.logger.log(`${message} succeeded`);
      } else if (result.status === 'Error') {
        this.logger.warn(`${message} failed`);
      }
    }
  }

  private createMigrator(): Migrator {
    return new Migrator({
      db: this.db,
      migrationLockTableName: 'kysely_migrations_lock',
      migrationTableName: 'kysely_migrations',
      provider: new FileMigrationProvider({
        fs: { readdir },
        path: { join },
        migrationFolder: MIGRATION_FOLDER,
      }),
    });
  }
}

export const migrateDatabase = async (config: DatabaseConfig, direction: 'up' | 'down' = 'up'): Promise<void> => {
  const db = createDatabase(config);
  const repository = new DatabaseRepository(db);

  try {
    if (direction === 'down') {
      await repository.revertLastMigration();
    } else {
      await repository.runMigrations();
    }
  } finally {
    await db.destroy();
  }
};
