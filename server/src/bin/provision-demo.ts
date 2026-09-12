import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import sharp from 'sharp';

import { createCloudNodeProcessorComposition } from 'src/composition.cloud-node';
import { DEMO_ACTIVITIES } from 'src/demo/demo-data';
import { provisionDemoData, type DemoImageMetadata } from 'src/demo/demo-provisioner';
import { JobStatus, QueueName } from 'src/enum';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';
import { MediaRepository } from 'src/repositories/media.repository';
import { SessionRepository } from 'src/repositories/session.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import type { KondisDatabase } from 'src/types';

const demoMediaDirectory = process.env.KONDIS_DEMO_MEDIA_DIR ?? resolve(process.cwd(), '../test/test-assets/demo/v1');

const readDemoImageMetadata = async (): Promise<Readonly<Record<string, readonly DemoImageMetadata[]>>> => {
  const entries = await Promise.all(
    DEMO_ACTIVITIES.map(async ({ slug, imageFiles }) => {
      const metadata = await Promise.all(
        imageFiles.map(async (imagePath): Promise<DemoImageMetadata> => {
          const filePath = resolve(demoMediaDirectory, 'activities', imagePath);
          const [fileStats, imageMetadata] = await Promise.all([stat(filePath), sharp(filePath).metadata()]);
          if (imageMetadata.width === undefined || imageMetadata.height === undefined) {
            throw new Error(`Could not read dimensions for demo image ${filePath}`);
          }
          return {
            originalName: basename(imagePath),
            storagePath: `activities/${imagePath}`,
            byteSize: fileStats.size,
            width: imageMetadata.width,
            height: imageMetadata.height,
          };
        }),
      );

      return [slug, metadata] as const;
    }),
  );
  return Object.fromEntries(entries);
};

const assertProvisioningCompleted = async (database: KondisDatabase): Promise<void> => {
  const [jobs, activities] = await Promise.all([
    database.selectFrom('background_job').select(['name', 'state', 'output']).orderBy('created_on').execute(),
    database
      .selectFrom('activity')
      .select(['id', 'metrics_computed_at', 'best_efforts_computed_at', 'route_matches_computed_at'])
      .execute(),
  ]);
  const unsuccessful = jobs.filter(({ state, output }) => {
    const status = output && typeof output === 'object' && 'status' in output ? output.status : undefined;
    return state !== 'completed' || status === JobStatus.Failed;
  });
  if (unsuccessful.length > 0) {
    throw new Error(
      `Demo provisioning jobs did not complete: ${unsuccessful.map(({ name, state }) => `${name} (${state})`).join(', ')}`,
    );
  }

  const incomplete = activities.filter(
    ({ metrics_computed_at, best_efforts_computed_at, route_matches_computed_at }) =>
      metrics_computed_at === null || best_efforts_computed_at === null || route_matches_computed_at === null,
  );
  if (activities.length !== DEMO_ACTIVITIES.length || incomplete.length > 0) {
    throw new Error(
      `Demo activity enrichment did not complete: expected ${DEMO_ACTIVITIES.length} activities, found ${activities.length}; incomplete IDs: ${incomplete.map(({ id }) => id).join(', ') || 'none'}`,
    );
  }
};

const main = async (): Promise<void> => {
  console.log(`Starting demo seed with media directory ${demoMediaDirectory}`);
  const configRepository = new ConfigRepository({ ...process.env, KONDIS_DEMO_MODE: 'true' });
  const config = configRepository.getEnv();
  console.log('Reading demo image metadata');
  const imageMetadata = await readDemoImageMetadata();
  console.log('Applying database migrations');
  await migrateDatabase(config.database);

  const application = createCloudNodeProcessorComposition({ configRepository });
  const { database } = application;
  try {
    await provisionDemoData({
      database,
      activities: new ActivityRepository(database),
      imageMetadata,
      images: new MediaRepository(database),
      uploads: new UploadRepository(database),
      social: new SocialRepository(database),
      sessions: new SessionRepository(database),
      users: new UserRepository(database),
    });
    console.log('Processing demo enrichment jobs');
    const processed = await application.drainJobs(QueueName.ActivityEnrichment);
    await assertProvisioningCompleted(database);
    console.log(`Demo database migrated, seeded, and fully processed (${processed} jobs).`);
  } finally {
    console.log('Closing database connection');
    await application.close();
  }
};

void main().catch((error: unknown) => {
  console.error('failed:', error);
  process.exitCode = 1;
});
