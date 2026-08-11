import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from 'src/app.module';
import { ConfigService } from 'src/config/config.service';
import { WorkerType } from 'src/enum';
import { migrateDatabase } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = new ConfigService();
  config.logStartupSummary();

  if (config.autoMigrate) {
    await migrateDatabase(config.database);
  }

  if (config.hasWorker(WorkerType.API)) {
    const app = await NestFactory.create(AppModule, { cors: false });
    app.enableShutdownHooks();
    await app.init();
    await app.get(EventRepository).attach(app.getHttpServer());
    await app.listen(config.port, '0.0.0.0'); // TODO: make host configurable
    logger.log(`Kondis server listening on 0.0.0.0 on port ${config.port}`);
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  logger.log('Kondis microservices started');
}

void bootstrap();
