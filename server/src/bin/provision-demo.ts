import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';

import { createDatabase } from 'src/db/database';
import { DEMO_FIT_SPECS } from 'src/demo/fit';
import { provisionDemoData, type DemoImageMetadata } from 'src/demo/provisioner';
import { ConsoleLogger } from 'src/logger';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { UploadRepository } from 'src/repositories/upload.repository';

const demoMediaDirectory = process.env.KONDIS_DEMO_MEDIA_DIR ?? resolve(process.cwd(), '../test/test-assets/demo/v1');

const readDemoImageMetadata = async (): Promise<Readonly<Record<string, readonly DemoImageMetadata[]>>> => {
  const entries = await Promise.all(
    DEMO_FIT_SPECS.map(async ({ slug }) => {
      const relativeDirectory = `activities/${slug}`;
      const directory = resolve(demoMediaDirectory, relativeDirectory);
      const entries = await readdir(directory, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jpg'))
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
      if (files.length === 0) {
        throw new Error(`No JPG demo images found in ${directory}`);
      }

      const metadata = await Promise.all(
        files.map(async (file): Promise<DemoImageMetadata> => {
          const filePath = resolve(directory, file.name);
          const [fileStats, imageMetadata] = await Promise.all([stat(filePath), sharp(filePath).metadata()]);
          if (imageMetadata.width === undefined || imageMetadata.height === undefined) {
            throw new Error(`Could not read dimensions for demo image ${filePath}`);
          }
          return {
            originalName: file.name,
            storagePath: `${relativeDirectory}/${file.name}`,
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
  const config = new ConfigRepository().getEnv();
  const imageMetadata = await readDemoImageMetadata();
  await migrateDatabase(config.database);

  const database = createDatabase(config.database);
  try {
    await provisionDemoData({
      database,
      activities: new ActivityRepository(database),
      imageMetadata,
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
