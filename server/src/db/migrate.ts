import { Logger } from '@nestjs/common';

import { DatabaseConfig } from 'src/config/config.service';
import { createDatabase, createMigrator } from 'src/db/database';

export type MigrateDirection = 'up' | 'down';

export const runMigrations = async (config: DatabaseConfig, direction: MigrateDirection = 'up'): Promise<void> => {
  const logger = new Logger('Migrations');
  const db = createDatabase(config);
  const migrator = createMigrator(db);

  try {
    const { error, results } = await (direction === 'down' ? migrator.migrateDown() : migrator.migrateToLatest());

    for (const result of results ?? []) {
      const label = `${result.direction} ${result.migrationName}`;
      if (result.status === 'Success') {
        logger.log(`applied ${label}`);
      } else if (result.status === 'Error') {
        logger.error(`failed ${label}`);
      }
    }

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    if ((results ?? []).length === 0) {
      logger.log('schema is up to date');
    }
  } finally {
    await db.destroy();
  }
};
