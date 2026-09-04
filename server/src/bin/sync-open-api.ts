import 'reflect-metadata';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from 'src/app.module';
import {
  ActivityDetailDto,
  ActivityListResponseDto,
  ActivityTagListResponseDto,
  ActivityTypeListResponseDto,
  BestEffortListResponseDto,
  MatchedRouteListResponseDto,
} from 'src/dtos/activity.dto';
import { PingResponseDto } from 'src/dtos/ping.dto';
import {
  CommentListDto,
  LikerListDto,
  NotificationListDto,
  PeopleListDto,
  PersonDto,
  RequestListDto,
} from 'src/dtos/social.dto';
import { API_PREFIX, createHonoOpenApiDocument } from 'src/hono/app';
import { createNodeHonoApp } from 'src/hono/node';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const UUID_PATTERN =
  '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';

const legacyRequiredQueryParameters = new Set([
  'GET /people query',
  'GET /notifications limit',
  'GET /activities/{id}/comments cursor',
  'GET /activities/{id}/comments limit',
]);

const normalizeHonoDocument = (document: ReturnType<typeof createHonoOpenApiDocument>) => {
  const paths = document.paths as Record<string, Record<string, unknown>>;
  const schemas: Record<string, unknown> = {};

  // Match nestjs-zod's OpenAPI shape so moving a route does not churn generated SDK types.
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, value] of Object.entries(pathItem)) {
      if (!isRecord(value) || !Array.isArray(value.parameters)) {
        continue;
      }

      for (const parameterValue of value.parameters) {
        if (!isRecord(parameterValue) || !isRecord(parameterValue.schema)) {
          continue;
        }

        const parameter = parameterValue;
        const schema = parameter.schema as Record<string, unknown>;
        if (schema.description === parameter.description) {
          delete schema.description;
        }
        if (schema.format === 'uuid') {
          schema.pattern = UUID_PATTERN;
        }

        const routeParameter = `${method.toUpperCase()} ${path} ${String(parameter.name)}`;
        if (legacyRequiredQueryParameters.has(routeParameter)) {
          parameter.required = true;
        }

        if (method === 'get' && path === '/activities/best-efforts/{sport}/{type}') {
          const componentName = parameter.name === 'sport' ? 'BestEffortSport' : 'BestEffortType';
          schemas[componentName] = schema;
          parameter.schema = { $ref: `#/components/schemas/${componentName}` };
        }
      }
    }
  }

  return { paths, schemas };
};

const orderLike = (value: unknown, reference: unknown): unknown => {
  if (Array.isArray(value)) {
    const referenceItems = Array.isArray(reference) ? reference : [];
    return value.map((item, index) => orderLike(item, referenceItems[index]));
  }
  if (!isRecord(value)) {
    return value;
  }

  const referenceRecord = isRecord(reference) ? reference : {};
  const keys = [
    ...Object.keys(referenceRecord).filter((key) => key in value),
    ...Object.keys(value).filter((key) => !(key in referenceRecord)),
  ];
  return Object.fromEntries(keys.map((key) => [key, orderLike(value[key], referenceRecord[key])]));
};

const readReferenceDocument = async (path: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

const mergePaths = (nestPaths: Record<string, unknown>, honoPaths: Record<string, unknown>) => {
  const paths = { ...nestPaths };
  for (const [path, honoPath] of Object.entries(honoPaths)) {
    const nestPath = isRecord(paths[path]) ? paths[path] : {};
    const mergedPath = { ...nestPath };
    if (isRecord(honoPath)) {
      for (const [method, honoOperation] of Object.entries(honoPath)) {
        const nestOperation = nestPath[method];
        mergedPath[method] =
          isRecord(nestOperation) && isRecord(honoOperation) ? { ...nestOperation, ...honoOperation } : honoOperation;
      }
    }
    paths[path] = mergedPath;
  }
  return paths;
};

async function run(): Promise<void> {
  process.env.KONDIS_DB_USERNAME ??= 'openapi';
  process.env.KONDIS_DB_PASSWORD ??= 'openapi';
  process.env.KONDIS_DB_DATABASE_NAME ??= 'openapi';

  const outputPath = resolve(process.cwd(), '..', 'open-api', 'kondis-openapi-specs.json');
  const referenceDocument = await readReferenceDocument(outputPath);
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    app.setGlobalPrefix(API_PREFIX.slice(1));

    const config = new DocumentBuilder()
      .setTitle('Kondis API')
      .setDescription('OpenAPI schema for Kondis')
      .setVersion('0.0.0')
      .addServer(API_PREFIX)
      .build();

    const nestDocument = cleanupOpenApiDoc(
      SwaggerModule.createDocument(app, config, {
        ignoreGlobalPrefix: true,
        extraModels: [
          ActivityDetailDto.Output,
          ActivityListResponseDto.Output,
          ActivityTagListResponseDto.Output,
          ActivityTypeListResponseDto.Output,
          BestEffortListResponseDto.Output,
          CommentListDto.Output,
          LikerListDto.Output,
          MatchedRouteListResponseDto.Output,
          NotificationListDto.Output,
          PeopleListDto.Output,
          PersonDto.Output,
          PingResponseDto.Output,
          RequestListDto.Output,
        ],
      }),
    );
    const honoDocument = normalizeHonoDocument(createHonoOpenApiDocument(createNodeHonoApp(app)));
    const schemas: Record<string, unknown> = { ...nestDocument.components?.schemas };
    for (const [name, schema] of Object.entries(honoDocument.schemas)) {
      schemas[name] ??= schema;
    }
    const document = {
      ...nestDocument,
      paths: mergePaths(nestDocument.paths, honoDocument.paths),
      components: {
        ...nestDocument.components,
        schemas,
      },
    };
    const orderedDocument = referenceDocument ? orderLike(document, referenceDocument) : document;

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(orderedDocument, null, 2)}\n`, 'utf8');
    console.log(`OpenAPI schema written to ${outputPath}`);
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  console.error('Failed to generate the OpenAPI schema:', error);
  process.exitCode = 1;
});
