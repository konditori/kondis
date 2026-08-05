import type { Migration, MigrationProvider } from 'kysely/migration';

import * as initial from 'src/db/migrations/001-initial';

export const migrations: Record<string, Migration> = {
  '001-initial': initial,
};

export class StaticMigrationProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve(migrations);
  }
}
