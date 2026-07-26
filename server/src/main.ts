import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from 'src/app.module';
import { ConfigService } from 'src/config/config.service';
import { runMigrations } from 'src/db/migrate';
import { WorkerType } from 'src/types';

/**
 * One entrypoint, one image, selectable roles.
 *
 * `KONDIS_WORKERS` defaults to running every role in a single process, which is what a
 * self-hosted install wants. Setting it to `api` or `jobs` splits them across containers with
 * no code or image change, so heavy parsing can be moved off the request path later.
 *
 * Config is constructed directly here rather than resolved from the container, because the
 * role decides whether an HTTP server is created at all. That has to be known before the
 * container is built. It also means an invalid KONDIS_WORKERS fails immediately at startup.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = new ConfigService();
  config.logStartupSummary();

  // Before the container exists, so the schema is guaranteed present prior to any query or
  // job consumption. Ordering this via a lifecycle hook would not be deterministic.
  if (config.autoMigrate) {
    await runMigrations(config.database);
  }

  if (config.hasWorker(WorkerType.API)) {
    const app = await NestFactory.create(AppModule, { cors: false });
    app.enableShutdownHooks();
    await app.listen(config.port, '0.0.0.0');
    logger.log(`API listening on port ${config.port}`);
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  logger.log('Started without the API role: consuming jobs only');
}

void bootstrap();
