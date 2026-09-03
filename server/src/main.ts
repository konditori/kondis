import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from 'src/app.module';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';
import { AuthService } from 'src/services/auth.service';

const API_PREFIX = 'api/v1';

export async function bootstrapApi(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = new ConfigRepository();
  config.logStartupSummary();

  await migrateDatabase(config.database);

  const app = await NestFactory.create(AppModule, { cors: false });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  await app.init();
  await app.get(AuthService).logSetupTokenIfRequired();
  await app.get(EventRepository).attach(app.getHttpServer());
  await app.listen(config.port, '0.0.0.0'); // TODO: make host configurable
  logger.log(`Kondis api listening on 0.0.0.0 on port ${config.port}`);
}

export async function bootstrapWorker(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = new ConfigRepository();
  config.logStartupSummary();
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  logger.log('Kondis background worker started');
}
