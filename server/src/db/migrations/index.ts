import type { Migration, MigrationProvider } from 'kysely';

import * as initial from 'src/db/migrations/001-initial';

/**
 * Migrations are registered statically rather than discovered from disk. Kysely's
 * FileMigrationProvider resolves paths at runtime, which behaves differently under tsx
 * and under the compiled `dist/` output; an explicit map behaves identically in both.
 *
 * Keys are the migration names recorded in the `kysely_migration` table. Never rename one.
 */
export const migrations: Record<string, Migration> = {
  '001-initial': initial,
};

export class StaticMigrationProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve(migrations);
  }
}
