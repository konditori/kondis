import type { Migration, MigrationProvider } from 'kysely/migration';

import * as initial from 'src/db/migrations/001-initial';
import * as activityMetrics from 'src/db/migrations/002-activity-metrics';

export const migrations: Record<string, Migration> = {
  '001-initial': initial,
  '002-activity-metrics': activityMetrics,
};

export class StaticMigrationProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve(migrations);
  }
}
