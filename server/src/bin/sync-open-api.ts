import 'reflect-metadata';

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from 'src/app.module';
import { API_PREFIX, createHonoApp, createHonoOpenApiDocument } from 'src/hono/app';
import { UserRepository } from 'src/repositories/user.repository';
import { ServerService } from 'src/services/server.service';

async function run(): Promise<void> {
  process.env.KONDIS_DB_USERNAME ??= 'openapi';
  process.env.KONDIS_DB_PASSWORD ??= 'openapi';
  process.env.KONDIS_DB_DATABASE_NAME ??= 'openapi';

  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix(API_PREFIX.slice(1));

  const config = new DocumentBuilder()
    .setTitle('Kondis API')
    .setDescription('OpenAPI schema for Kondis')
    .setVersion('0.0.0')
    .addServer(API_PREFIX)
    .build();

  const nestDocument = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true }));
  const honoDocument = createHonoOpenApiDocument(
    createHonoApp({ server: app.get(ServerService), users: app.get(UserRepository) }),
  );
  const honoPingOperation = honoDocument.paths['/ping']?.get;
  if (!honoPingOperation) {
    throw new Error('Hono OpenAPI document is missing GET /ping');
  }
  const document = {
    ...nestDocument,
    paths: {
      ...nestDocument.paths,
      '/ping': {
        ...nestDocument.paths['/ping'],
        get: {
          ...nestDocument.paths['/ping']?.get,
          ...honoPingOperation,
        },
      },
    },
    components: {
      ...nestDocument.components,
      schemas: {
        ...nestDocument.components?.schemas,
        ...honoDocument.components?.schemas,
      },
    },
  };
  const outputPath = resolve(process.cwd(), '..', 'open-api', 'kondis-openapi-specs.json');

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  console.log(`OpenAPI schema written to ${outputPath}`);
}

run().catch((error: unknown) => {
  console.error('Failed to generate the OpenAPI schema:', error);
  process.exitCode = 1;
});
