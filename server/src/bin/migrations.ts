import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ConfigService } from 'src/config/config.service';
import { migrateDatabase } from 'src/repositories/database.repository';

const usage = 'Usage: migrations <create NAME | run | revert>';

const createMigration = async (name: string): Promise<string> => {
  const migrationName = name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

  if (!migrationName) {
    throw new Error('A migration name is required');
  }

  const filename = `${Date.now()}-${migrationName}.ts`;
  // eslint-disable-next-line unicorn/prefer-module
  const path = join(__dirname, '..', 'schema', 'migrations', filename);
  const contents = `import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  void db;
}

export async function down(db: Kysely<unknown>): Promise<void> {
  void db;
}
`;

  await writeFile(path, contents, { flag: 'wx' });
  return path;
};

const main = async (): Promise<void> => {
  const [command, ...arguments_] = process.argv.slice(2);

  switch (command) {
    case 'create': {
      const path = await createMigration(arguments_.join(' '));
      console.log(`Created ${path}`);
      break;
    }
    case 'run': {
      await migrateDatabase(new ConfigService().database);
      break;
    }
    case 'revert': {
      await migrateDatabase(new ConfigService().database, 'down');
      break;
    }
    default: {
      throw new Error(usage);
    }
  }
};

void main().catch((error: unknown) => {
  console.error('[migrations] failed:', error);
  process.exitCode = 1;
});
