import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from 'src/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    cors: false,
  });

  const port = Number(process.env.PORT ?? process.env.KONDIS_PORT ?? 2293);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();