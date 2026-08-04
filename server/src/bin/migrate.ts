import { ConfigService } from 'src/config/config.service';
import { MigrateDirection, runMigrations } from 'src/db/migrate';

const main = async (): Promise<void> => {
  const direction = (process.argv[2] ?? 'up') as MigrateDirection;
  const config = new ConfigService();

  try {
    await runMigrations(config.database, direction);
  } catch (error) {
    console.error('[migrate] failed:', error);
    process.exitCode = 1;
  }
};

void main();
