import { createDatabase } from 'src/db/database';
import { provisionDemoData } from 'src/demo/provisioner';
import { ConsoleLogger } from 'src/logger';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { UploadRepository } from 'src/repositories/upload.repository';

const main = async (): Promise<void> => {
  const config = new ConfigRepository().getEnv();
  await migrateDatabase(config.database);

  const database = createDatabase(config.database);
  try {
    await provisionDemoData({
      database,
      activities: new ActivityRepository(database),
      images: new ActivityImageRepository(database),
      uploads: new UploadRepository(database),
      fit: new FitRepository(new ConsoleLogger()),
    });
    console.log('Demo database migrated and seeded.');
  } finally {
    await database.destroy();
  }
};

void main().catch((error: unknown) => {
  console.error('[demo-seeder] failed:', error);
  process.exitCode = 1;
});
