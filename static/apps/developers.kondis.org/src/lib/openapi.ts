import rawSpec from "../../../../../open-api/kondis-openapi-specs.json";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type Reference = { $ref: string };

export type Schema = {
  $ref?: string;
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  default?: unknown;
  example?: unknown;
  enum?: Array<string | number | boolean>;
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  additionalProperties?: boolean | Schema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};

export type Parameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: Schema;
};

type MediaType = { schema?: Schema };
type Content = Record<string, MediaType>;

type Operation = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: Parameter[];
  requestBody?: Reference | { required?: boolean; content?: Content };
  responses?: Record<
    string,
    Reference | { description?: string; content?: Content }
  >;
};

type OpenApiSpec = {
  info: { title: string; description?: string; version: string };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Partial<Record<HttpMethod, Operation>>>;
  components?: { schemas?: Record<string, Schema> };
};

export type ApiResponse = {
  status: string;
  description: string;
  contentType?: string;
  schema?: Schema;
};

export type Endpoint = {
  method: HttpMethod;
  path: string;
  operationId: string;
  sdkName: string;
  slug: string;
  href: string;
  title: string;
  description?: string;
  tag: string;
  tagSlug: string;
  deprecated: boolean;
  parameters: Parameter[];
  request?: {
    required: boolean;
    contentType: string;
    schema?: Schema;
  };
  responses: ApiResponse[];
};

export type EndpointGroup = {
  name: string;
  slug: string;
  href: string;
  description: string;
  endpoints: Endpoint[];
};

export type ApiModel = {
  name: string;
  slug: string;
  href: string;
  schema: Schema;
};

const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete"];
const spec = rawSpec as OpenApiSpec;

const tagDescriptions: Record<string, string> = {
  Auth: "Session setup, account registration, and identity checks.",
  Social: "People, follows, reactions, comments, and notifications.",
  User: "Profiles, avatars, and user administration.",
  activities: "Activity history, metrics, tags, routes, and best efforts.",
  "activity-images": "Upload and manage images attached to activities.",
  jobs: "Inspect and control background processing queues.",
  "live workouts": "Record, share, and stream workouts in progress.",
  server: "Service health and capability discovery.",
  uploads: "Import activity files and external data archives.",
};

export const apiInfo = spec.info;
export const apiBasePath = spec.servers?.[0]?.url ?? "/api/v1";
export const schemas = spec.components?.schemas ?? {};

export function slugify(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function humanize(value: string): string {
  return value
    .replace(/^.*Controller_/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function sdkName(operationId: string): string {
  const normalized = operationId.replace(/_([a-zA-Z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function firstContent(
  content?: Content,
): { contentType: string; schema?: Schema } | undefined {
  if (!content) return;
  const entry = Object.entries(content)[0];
  if (!entry) return;
  return { contentType: entry[0], schema: entry[1].schema };
}

function parseResponses(operation: Operation): ApiResponse[] {
  return Object.entries(operation.responses ?? {}).map(([status, response]) => {
    if (isReference(response)) {
      return {
        status,
        description: "Referenced response",
        schema: response,
      };
    }

    return {
      status,
      description: response.description ?? "Response",
      ...firstContent(response.content),
    };
  });
}

function parseRequest(operation: Operation): Endpoint["request"] {
  if (!operation.requestBody || isReference(operation.requestBody)) return;
  const content = firstContent(operation.requestBody.content);
  if (!content) return;
  return { required: operation.requestBody.required ?? false, ...content };
}

export const endpoints: Endpoint[] = Object.entries(spec.paths).flatMap(
  ([path, pathItem]) =>
    HTTP_METHODS.flatMap((method) => {
      const operation = pathItem[method];
      if (!operation) return [];

      const operationId = operation.operationId ?? `${method}-${slugify(path)}`;
      const tag = operation.tags?.[0] ?? "other";
      const tagSlug = slugify(tag);
      const slug = slugify(operationId);

      return [
        {
          method,
          path,
          operationId,
          sdkName: sdkName(operationId),
          slug,
          href: `/api/endpoints/${tagSlug}/${slug}`,
          title: operation.summary ?? humanize(operationId),
          description: operation.description,
          tag,
          tagSlug,
          deprecated: operation.deprecated ?? false,
          parameters: operation.parameters ?? [],
          request: parseRequest(operation),
          responses: parseResponses(operation),
        },
      ] satisfies Endpoint[];
    }),
);

export const endpointGroups: EndpointGroup[] = Array.from(
  new Set(endpoints.map((endpoint) => endpoint.tag)),
)
  .map((name) => {
    const slug = slugify(name);
    return {
      name,
      slug,
      href: `/api/endpoints/${slug}`,
      description:
        tagDescriptions[name] ?? `Operations grouped under ${humanize(name)}.`,
      endpoints: endpoints.filter((endpoint) => endpoint.tag === name),
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

export const models: ApiModel[] = Object.entries(schemas)
  .map(([name, schema]) => ({
    name,
    slug: encodeURIComponent(name),
    href: `/api/models/${encodeURIComponent(name)}`,
    schema,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

export function getEndpoint(tagSlug: string, endpointSlug: string) {
  return endpoints.find(
    (endpoint) =>
      endpoint.tagSlug === tagSlug && endpoint.slug === endpointSlug,
  );
}

export function getGroup(tagSlug: string) {
  return endpointGroups.find((group) => group.slug === tagSlug);
}

export function getModel(name: string) {
  return models.find((model) => model.name === name);
}

export function isReference(value: unknown): value is Reference {
  return Boolean(value && typeof value === "object" && "$ref" in value);
}

export function referenceName(
  reference: Reference | Schema,
): string | undefined {
  return reference.$ref?.split("/").at(-1);
}

export function modelHref(reference: Reference | Schema): string | undefined {
  const name = referenceName(reference);
  return name ? `/models/${encodeURIComponent(name)}` : undefined;
}

export function schemaType(schema?: Schema): string {
  if (!schema) return "unknown";
  const reference = referenceName(schema);
  if (reference) return reference;
  if (schema.enum) return schema.enum.map(String).join(" | ");
  if (schema.items) return `${schemaType(schema.items)}[]`;
  if (schema.oneOf) return schema.oneOf.map(schemaType).join(" | ");
  if (schema.anyOf) return schema.anyOf.map(schemaType).join(" | ");
  if (schema.allOf) return schema.allOf.map(schemaType).join(" & ");
  return [schema.type ?? "object", schema.format].filter(Boolean).join(":");
}

export function exampleForSchema(
  schema: Schema | undefined,
  seen = new Set<string>(),
): unknown {
  if (!schema) return {};
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];

  const name = referenceName(schema);
  if (name) {
    if (seen.has(name)) return `[${name}]`;
    seen.add(name);
    return exampleForSchema(schemas[name], seen);
  }

  if (schema.oneOf?.length) return exampleForSchema(schema.oneOf[0], seen);
  if (schema.anyOf?.length) return exampleForSchema(schema.anyOf[0], seen);
  if (schema.allOf?.length) {
    return Object.assign(
      {},
      ...schema.allOf.map((part) => exampleForSchema(part, seen)),
    );
  }
  if (schema.items) return [exampleForSchema(schema.items, seen)];
  if (schema.type === "boolean") return true;
  if (schema.type === "integer" || schema.type === "number") return 0;
  if (schema.type === "string") {
    if (schema.format === "date-time") return "2026-08-25T08:00:00Z";
    if (schema.format === "date") return "2026-08-25";
    return "string";
  }

  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([property, value]) => [
      property,
      exampleForSchema(value, new Set(seen)),
    ]),
  );
}
