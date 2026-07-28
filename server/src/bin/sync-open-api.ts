import 'reflect-metadata';

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from 'src/app.module';

async function run(): Promise<void> {
  // The OpenAPI document is derived entirely from decorators; no query is ever issued and the
  // connection pool is created lazily. Supply placeholders so ConfigService's fail-fast
  // validation does not demand a real database just to emit a schema.
  process.env.DB_USERNAME ??= 'openapi';
  process.env.DB_PASSWORD ??= 'openapi';
  process.env.DB_DATABASE_NAME ??= 'openapi';
  process.env.KONDIS_WORKERS ??= 'api';
  process.env.KONDIS_DB_AUTO_MIGRATE ??= 'false';

  const app = await NestFactory.create(AppModule, {
    logger: false,
    // Without this Nest logs through the disabled logger and calls process.exit(1), so a
    // bootstrap failure would surface as a silent non-zero exit.
    abortOnError: false,
  });

  const config = new DocumentBuilder()
    .setTitle('Kondis API')
    .setDescription('OpenAPI schema for the Kondis server')
    .setVersion('0.0.0')
    .build();

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  const outputPath = resolve(process.cwd(), '..', 'open-api', 'kondis-openapi-specs.json');

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  console.log(`OpenAPI schema written to ${outputPath}`);
}

run().catch((error: unknown) => {
  // Nest's logger is disabled above to keep the output clean, which would otherwise make a
  // bootstrap failure exit silently with code 1.
  console.error('Failed to generate the OpenAPI schema:', error);
  process.exitCode = 1;
});
