import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import sharp from 'sharp';

import { createDatabase } from 'src/db/database';
import { DEMO_ACTIVITIES } from 'src/demo/data';
import { provisionDemoData, type DemoImageMetadata } from 'src/demo/provisioner';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';
import { MediaRepository } from 'src/repositories/media.repository';
import { SessionRepository } from 'src/repositories/session.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';

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

const main = async (): Promise<void> => {
  console.log(`Starting demo seed with media directory ${demoMediaDirectory}`);
  const config = new ConfigRepository().getEnv();
  console.log('Reading demo image metadata');
  const imageMetadata = await readDemoImageMetadata();
  console.log('Applying database migrations');
  await migrateDatabase(config.database);

  const database = createDatabase(config.database);
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
    console.log('Demo database migrated and seeded.');
  } finally {
    console.log('Closing database connection');
    await database.destroy();
  }
};

void main().catch((error: unknown) => {
  console.error('failed:', error);
  process.exitCode = 1;
});
