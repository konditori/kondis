import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from 'src/app.module';
import { API_PREFIX } from 'src/hono/app';
import { createNodeHonoApp, mountHonoApp } from 'src/hono/node';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';
import { AuthService } from 'src/services/auth.service';

export async function bootstrapApi(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = new ConfigRepository();
  config.logStartupSummary();

  await migrateDatabase(config.database);

  const app = await NestFactory.create(AppModule, { cors: false });
  mountHonoApp(app, createNodeHonoApp(app, config.getEnv()));
  app.setGlobalPrefix(API_PREFIX.slice(1));
  app.enableShutdownHooks();
  await app.init();
  await app.get(AuthService).logSetupTokenIfRequired();
  await app.get(EventRepository).attach(app.getHttpServer());
  await app.listen(config.port, config.listenAddress);
  logger.log(`Kondis api listening on ${config.listenAddress} on port ${config.port}`);
}

export async function bootstrapWorker(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = new ConfigRepository();
  config.logStartupSummary();
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  logger.log('Kondis background worker started');
}
