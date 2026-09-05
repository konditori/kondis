import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { createOpenApiDocument } from 'src/api/app';
import { createNodeApiApp } from 'src/api/node';
import { createApplicationComposition } from 'src/composition.node';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const UUID_PATTERN =
  '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';
const DATETIME_PATTERN = String.raw`^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z))$`;

// Preserve established output suffixes and retain input variants only when both forms are used.
const outputOnlySchemaNames = new Map([
  ['ActivityMetricDto', 'ActivityMetricDto_Output'],
  ['ActivityTypeSettings', 'ActivityTypeSettings_Output'],
  ['BestEffortValueKind', 'BestEffortValueKind_Output'],
  ['JobCountsDto', 'JobCountsDto_Output'],
  ['QueueStatusDto', 'QueueStatusDto_Output'],
]);
const dualOutputSchemaNames = new Map([
  ['ActivityTag', 'ActivityTag_Output'],
  ['ActivityType', 'ActivityType_Output'],
  ['BestEffortSport', 'BestEffortSport_Output'],
  ['BestEffortType', 'BestEffortType_Output'],
  ['QueueName', 'QueueName_Output'],
]);

const legacyPathOrder = [
  '/ping',
  '/upload/activity',
  '/upload/strava',
  '/upload/strava/{id}',
  '/jobs',
  '/jobs/history',
  '/jobs/{name}',
  '/live-workouts',
  '/live-workouts/shared/{token}',
  '/live-workouts/{id}',
  '/live-workouts/{id}/points',
  '/live-workouts/{id}/share',
  '/activities',
  '/activities/types',
  '/activities/tags',
  '/activities/best-efforts/{sport}/{type}',
  '/activities/{id}',
  '/activities/{id}/matched-routes',
  '/activities/{id}/images',
  '/activities/{activityId}/images/{imageId}',
  '/activity-images/{imageId}/{variant}',
  '/auth/capabilities',
  '/auth/setup',
  '/auth/setup/verify',
  '/auth/setup/validate',
  '/auth/login',
  '/auth/register',
  '/auth/me',
  '/auth/logout',
  '/auth/activity-events-ticket',
  '/auth/job-events-ticket',
  '/users',
  '/users/me',
  '/users/me/avatar',
  '/users/{id}/avatar',
  '/people',
  '/people/{id}',
  '/people/{id}/activities',
  '/people/{id}/follow-request',
  '/people/{id}/follow',
  '/people/{id}/block',
  '/follow-requests',
  '/follow-requests/{id}/accept',
  '/follow-requests/{id}',
  '/feed',
  '/activities/{id}/like',
  '/activities/{id}/likes',
  '/notifications',
  '/notifications/read',
  '/activities/{id}/comments',
  '/activities/{activityId}/comments/{commentId}',
];

const legacySchemaOrder = [
  'PingResponseDto_Output',
  'FitUploadResponseDto_Output',
  'LagomTakeoutUploadResponseDto_Output',
  'TakeoutImportStatusDto_Output',
  'JobCountsDto_Output',
  'QueueStatusDto_Output',
  'AllJobStatusResponseDto_Output',
  'QueueName_Output',
  'JobHistoryResponseDto_Output',
  'JobCreateDto',
  'QueueCommandDto',
  'QueueStatusReportDto_Output',
  'ActivityType_Output',
  'LiveWorkoutListDto_Output',
  'ActivityType',
  'LiveWorkoutCreateDto',
  'LiveWorkoutDto_Output',
  'LiveWorkoutPointsDto',
  'LiveWorkoutAckDto_Output',
  'LiveWorkoutStateDto',
  'LiveWorkoutShareDto_Output',
  'ActivityTag_Output',
  'ActivityMetricDto_Output',
  'BestEffortType_Output',
  'ActivityListResponseDto_Output',
  'ActivityTypeSettings_Output',
  'ActivityTypeListResponseDto_Output',
  'ActivityTagListResponseDto_Output',
  'BestEffortSport_Output',
  'BestEffortValueKind_Output',
  'BestEffortListResponseDto_Output',
  'ActivityDetailDto_Output',
  'MatchedRouteListResponseDto_Output',
  'ActivityTag',
  'ActivityUpdateDto',
  'ActivityDto_Output',
  'ActivityImageDto_Output',
  'ActivityImageListDto_Output',
  'ActivityImageUpdateDto',
  'AuthCapabilitiesDto_Output',
  'SetupStatusDto_Output',
  'SetupTicketDto_Output',
  'SetupValidationDto_Output',
  'AuthSessionDto_Output',
  'AuthUserDto_Output',
  'ActivityEventsTicketDto_Output',
  'PeopleListDto_Output',
  'PersonDto_Output',
  'RequestListDto_Output',
  'LikeStateDto_Output',
  'LikerListDto_Output',
  'NotificationListDto_Output',
  'NotificationsReadDto_Output',
  'CommentListDto_Output',
  'CommentCreateDto',
  'CommentDto_Output',
  'CommentUpdateDto',
  'QueueName',
  'BestEffortSport',
  'BestEffortType',
];

const normalizeSchema = (schema: Record<string, unknown>, options: { output: boolean }): void => {
  // Preserve the previous Zod-to-OpenAPI details until the published contract can be versioned.
  if (typeof schema.$ref === 'string') {
    const name = schema.$ref.replace('#/components/schemas/', '');
    const outputName = outputOnlySchemaNames.get(name) ?? dualOutputSchemaNames.get(name);
    if (outputName && (options.output || outputOnlySchemaNames.has(name))) {
      schema.$ref = `#/components/schemas/${outputName}`;
    }
  }

  if (schema.format === 'uuid') {
    schema.pattern = UUID_PATTERN;
  } else if (schema.format === 'date-time') {
    schema.pattern = DATETIME_PATTERN;
  }

  if (schema.type === 'integer') {
    if (schema.minimum === undefined && schema.exclusiveMinimum === undefined) {
      schema.minimum = -Number.MAX_SAFE_INTEGER;
    }
    if (schema.maximum === undefined && schema.exclusiveMaximum === undefined) {
      schema.maximum = Number.MAX_SAFE_INTEGER;
    }
  }

  if (schema.type === 'object' && isRecord(schema.properties)) {
    for (const property of Object.values(schema.properties)) {
      if (isRecord(property)) {
        normalizeSchema(property, options);
      }
    }
    if (options.output) {
      schema.additionalProperties ??= false;
    }
  }
  if (schema.type === 'array' && isRecord(schema.items)) {
    normalizeSchema(schema.items, options);
  }
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    const values = schema[keyword];
    if (Array.isArray(values)) {
      for (const value of values) {
        if (isRecord(value)) {
          normalizeSchema(value, options);
        }
      }
    }
  }
};

const normalizeComponentSchemas = (document: ReturnType<typeof createOpenApiDocument>): void => {
  const components = document.components as Record<string, unknown> | undefined;
  if (!components || !isRecord(components.schemas)) {
    throw new Error('Hono did not generate OpenAPI component schemas');
  }
  const schemas = components.schemas;

  let activityMetricSchema: Record<string, unknown> | undefined;
  for (const [name, schema] of Object.entries(schemas)) {
    if (!name.endsWith('_Output') || !isRecord(schema)) {
      continue;
    }
    const stack = [schema];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (isRecord(current.properties)) {
        const metrics = current.properties.metrics;
        if (isRecord(metrics) && metrics.type === 'object' && isRecord(metrics.properties)) {
          // Hono inlines a described nullable registered schema; the previous generator retained its component ref.
          activityMetricSchema ??= structuredClone(metrics);
          delete activityMetricSchema.nullable;
          delete activityMetricSchema.description;
          current.properties.metrics = {
            allOf: [{ $ref: '#/components/schemas/ActivityMetricDto_Output' }],
            nullable: true,
            ...(typeof metrics.description === 'string' && { description: metrics.description }),
          };
        }
        for (const property of Object.values(current.properties)) {
          if (isRecord(property)) {
            stack.push(property);
          }
        }
      }
      if (current.type === 'array' && isRecord(current.items)) {
        stack.push(current.items);
      }
    }
  }
  if (!activityMetricSchema) {
    throw new Error('Hono did not generate the activity metric schema');
  }
  schemas.ActivityMetricDto = activityMetricSchema;

  for (const [sourceName, outputName] of outputOnlySchemaNames) {
    const schema = schemas[sourceName];
    if (!schema) {
      throw new Error(`Hono did not generate the ${sourceName} schema`);
    }
    schemas[outputName] = schema;
    delete schemas[sourceName];
  }
  for (const [sourceName, outputName] of dualOutputSchemaNames) {
    const schema = schemas[sourceName];
    if (!schema) {
      throw new Error(`Hono did not generate the ${sourceName} schema`);
    }
    schemas[outputName] = structuredClone(schema);
  }

  for (const [name, schema] of Object.entries(schemas)) {
    if (isRecord(schema)) {
      normalizeSchema(schema, { output: name.endsWith('_Output') });
    }
  }
  if (isRecord(components.parameters) && Object.keys(components.parameters).length === 0) {
    delete components.parameters;
  }
};

const normalizeApiDocument = (document: ReturnType<typeof createOpenApiDocument>) => {
  document.info.contact ??= {};
  document.tags ??= [];
  normalizeComponentSchemas(document);

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const [method, value] of Object.entries(pathItem ?? {})) {
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

        if (method === 'get' && path === '/jobs/history' && parameter.name === 'offset') {
          schema.maximum = Number.MAX_SAFE_INTEGER;
          delete schema.nullable;
        }
        if (method === 'put' && path === '/jobs/{name}' && parameter.name === 'name') {
          delete parameter.description;
        }

        if (method === 'get' && path === '/activities/best-efforts/{sport}/{type}') {
          const componentName = parameter.name === 'sport' ? 'BestEffortSport' : 'BestEffortType';
          parameter.schema = { $ref: `#/components/schemas/${componentName}` };
        }
      }
    }
  }

  return document;
};

const orderRecord = (record: Record<string, unknown>, order: string[]): Record<string, unknown> => {
  const keys = [...order.filter((key) => key in record), ...Object.keys(record).filter((key) => !order.includes(key))];
  return Object.fromEntries(keys.map((key) => [key, record[key]]));
};

const orderSchema = (
  schema: Record<string, unknown>,
  options: { directRootProperty?: boolean; output: boolean },
): Record<string, unknown> => {
  const orderedValues = { ...schema };
  if (isRecord(schema.properties)) {
    orderedValues.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, property]) => [
        name,
        isRecord(property)
          ? orderSchema(property, {
              directRootProperty: options.directRootProperty === undefined,
              output: options.output,
            })
          : property,
      ]),
    );
  }
  if (isRecord(schema.items)) {
    orderedValues.items = orderSchema(schema.items, { directRootProperty: false, output: options.output });
  }
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    const values = schema[keyword];
    if (Array.isArray(values)) {
      orderedValues[keyword] = values.map((value) =>
        isRecord(value) ? orderSchema(value, { directRootProperty: false, output: options.output }) : value,
      );
    }
  }

  let order = ['type', 'format', 'pattern', 'minLength', 'maxLength', 'enum', 'description', 'nullable'];
  switch (schema.type) {
    case 'object': {
      order = ['type', 'properties', 'required', 'additionalProperties', 'description', 'nullable'];
      break;
    }
    case 'array': {
      const descriptionFirst =
        typeof schema.description === 'string' &&
        isRecord(schema.items) &&
        (schema.items.type === 'string' || schema.items.$ref === '#/components/schemas/ActivityTag');
      order = descriptionFirst
        ? ['description', 'minItems', 'maxItems', 'type', 'items', 'nullable']
        : ['minItems', 'maxItems', 'type', 'items', 'description', 'nullable'];
      break;
    }
    case 'integer':
    case 'number': {
      order =
        schema.exclusiveMinimum === true && typeof schema.minimum === 'number'
          ? ['type', 'exclusiveMinimum', 'maximum', 'description', 'nullable', 'minimum']
          : ['type', 'exclusiveMinimum', 'minimum', 'maximum', 'description', 'nullable'];
      break;
    }
    case 'boolean': {
      if (Array.isArray(schema.enum)) {
        order = ['type', 'description', 'enum'];
      } else if (options.directRootProperty && !options.output && typeof schema.description === 'string') {
        order = ['description', 'type'];
      }
      break;
    }
    case 'string': {
      if (
        typeof schema.description === 'string' &&
        !options.directRootProperty &&
        schema.format === undefined &&
        schema.enum === undefined &&
        schema.minLength === undefined &&
        schema.maxLength === undefined
      ) {
        order = ['description', 'type', 'nullable'];
      } else if (
        options.directRootProperty &&
        !options.output &&
        schema.format === 'date-time' &&
        typeof schema.description === 'string'
      ) {
        order = ['description', 'type', 'format', 'pattern', 'nullable'];
      }
      break;
    }
  }
  if (typeof schema.$ref === 'string') {
    order = ['$ref', 'description', 'nullable'];
  }
  if (schema.allOf !== undefined) {
    order = ['allOf', 'nullable', 'description'];
  } else if (schema.anyOf !== undefined && schema.type === undefined) {
    order = ['anyOf', 'nullable', 'description'];
  }
  return orderRecord(orderedValues, order);
};

const orderParameterSchema = (schema: Record<string, unknown>): Record<string, unknown> => {
  if (schema.format === 'uuid') {
    return orderRecord(schema, ['format', 'pattern', 'type']);
  }
  if (schema.default !== undefined && Array.isArray(schema.enum)) {
    return orderRecord(schema, ['default', 'type', 'enum']);
  }
  if (schema.type === 'integer') {
    return orderRecord(schema, ['minimum', 'maximum', 'default', 'type']);
  }
  if (schema.type === 'string') {
    return orderRecord(schema, ['minLength', 'maxLength', 'type', 'enum', 'default']);
  }
  return schema;
};

const orderPaths = (paths: Record<string, unknown>): Record<string, unknown> =>
  orderRecord(
    Object.fromEntries(
      Object.entries(paths).map(([path, pathItem]) => [
        path,
        isRecord(pathItem)
          ? Object.fromEntries(
              Object.entries(pathItem).map(([method, operation]) => {
                if (!isRecord(operation)) {
                  return [method, operation];
                }
                const orderedOperation = { ...operation };
                if (Array.isArray(operation.parameters)) {
                  orderedOperation.parameters = operation.parameters.map((parameter) => {
                    if (!isRecord(parameter)) {
                      return parameter;
                    }
                    const orderedParameter = { ...parameter };
                    if (isRecord(parameter.schema)) {
                      orderedParameter.schema = orderParameterSchema(parameter.schema);
                    }
                    return orderRecord(orderedParameter, ['name', 'required', 'in', 'description', 'schema']);
                  });
                }
                return [
                  method,
                  orderRecord(orderedOperation, [
                    'description',
                    'operationId',
                    'parameters',
                    'requestBody',
                    'responses',
                    'summary',
                    'tags',
                  ]),
                ];
              }),
            )
          : pathItem,
      ]),
    ),
    legacyPathOrder,
  );

const orderDocument = (document: ReturnType<typeof createOpenApiDocument>) => {
  const components = document.components as Record<string, unknown>;
  const schemas = components.schemas as Record<string, unknown>;
  const orderedSchemas = Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      isRecord(schema) ? orderSchema(schema, { output: name.endsWith('_Output') }) : schema,
    ]),
  );
  return {
    openapi: document.openapi,
    paths: orderPaths(document.paths as Record<string, unknown>),
    info: document.info,
    tags: document.tags,
    servers: document.servers,
    components: {
      ...components,
      schemas: orderRecord(orderedSchemas, legacySchemaOrder),
    },
  };
};

async function run(): Promise<void> {
  process.env.KONDIS_DB_USERNAME ??= 'openapi';
  process.env.KONDIS_DB_PASSWORD ??= 'openapi';
  process.env.KONDIS_DB_DATABASE_NAME ??= 'openapi';

  const canonicalPath = resolve(process.cwd(), '..', 'open-api', 'kondis-openapi-specs.json');
  const outputPath = process.env.KONDIS_OPENAPI_OUTPUT ?? canonicalPath;
  const application = createApplicationComposition({ role: 'api', logLevels: [] });
  try {
    const document = normalizeApiDocument(createOpenApiDocument(createNodeApiApp(application)));
    const orderedDocument = orderDocument(document);
    const serialized = `${JSON.stringify(orderedDocument, null, 2)}\n`;

    if (process.argv.includes('--check')) {
      const current = await readFile(outputPath, 'utf8');
      if (current !== serialized) {
        throw new Error('OpenAPI schema is not up to date');
      }
      console.log(`OpenAPI schema is up to date: ${outputPath}`);
      return;
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, 'utf8');
    console.log(`OpenAPI schema written to ${outputPath}`);
  } finally {
    await application.close();
  }
}

run().catch((error: unknown) => {
  console.error('Failed to generate the OpenAPI schema:', error);
  process.exitCode = 1;
});
