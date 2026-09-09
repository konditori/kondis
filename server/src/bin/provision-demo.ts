import { resolve } from 'node:path';

import { createApplicationComposition } from 'src/composition.node';
import { provisionDemoData } from 'src/demo/provisioner';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';

const demoMediaDirectory = process.env.KONDIS_DEMO_MEDIA_DIR ?? resolve(process.cwd(), '../test/test-assets/demo/v1');

const main = async (): Promise<void> => {
  const config = new ConfigRepository().getEnv();
  await migrateDatabase(config.database);
  const application = createApplicationComposition({ role: 'api' });
  try {
    const setupStatus = await application.authService.setupStatus();
    if (!setupStatus.setupRequired) {
      console.log('Demo database is already seeded.');
      return;
    }
    await provisionDemoData({
      activities: application.activityService,
      images: application.activityImageService,
      auth: application.authService,
      social: application.socialService,
      users: application.userService,
      queue: application.queueAdapter,
      mediaDirectory: demoMediaDirectory,
    });
    console.log('Demo database migrated, seeded, and fully processed.');
  } finally {
    await application.close();
  }
};

void main().catch((error: unknown) => {
  console.error('[demo-seeder] failed:', error);
  process.exitCode = 1;
});
