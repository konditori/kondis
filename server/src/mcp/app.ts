import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import type { ApiBindings, ApiSessionLookup } from 'src/api/auth';
import { getAccessToken } from 'src/auth';
import type { StorageRepository } from 'src/contracts/storage.repository';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  PayloadTooLargeException,
  UnauthorizedException,
} from 'src/errors';
import { SCOPES, type Principal } from 'src/mcp/context';
import type { McpOAuthService } from 'src/mcp/oauth';
import { AuthorizationSchema, RegistrationSchema } from 'src/mcp/oauth';
import { createMcpServer, TOOL_SCOPES } from 'src/mcp/registry';
import type { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { CreateKeySchema, type ApiKeyService } from 'src/services/api-key.service';
import type { McpPreferenceService } from 'src/services/mcp-preference.service';
import type { OperationService } from 'src/services/operation.service';
import { requestClientId } from 'src/utils/request-client-id';
import { z } from 'zod';

export type McpDependencies = {
  queries: ActivityQueryService;
  sessions: ApiSessionLookup;
  keys: ApiKeyService;
  operations: OperationService;
  oauth: McpOAuthService;
  preferences: McpPreferenceService;
  rateLimiting: RateLimitingRepository;
  storage?: StorageRepository;
  publicUrl?: string;
  trustProxyHeaders?: boolean;
  mutationsEnabled?: boolean;
  demoUserId?: string;
  demoMode?: boolean;
};

export const isMcpPath = (path: string) =>
  path === '/mcp' ||
  path.startsWith('/mcp/') ||
  path.startsWith('/oauth/') ||
  path.startsWith('/.well-known/oauth-') ||
  path.startsWith('/api/v1/connections') ||
  path.startsWith('/connections');

export async function readBounded(request: Request, maximum: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > maximum) {
    throw new PayloadTooLargeException();
  }
  const reader = request.body?.getReader();
  if (!reader) {
    return new Uint8Array();
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.length;
      if (size > maximum) {
        await reader.cancel();
        throw new PayloadTooLargeException();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

const json = async (request: Request) => JSON.parse(new TextDecoder().decode(await readBounded(request, 16 * 1024)));

export function createMcpApp(deps: McpDependencies) {
  const app = new Hono<{
    Bindings: ApiBindings;
    Variables: { principal: Principal; sessionUserId: string; body: unknown };
  }>();
  const { keys, operations, oauth, preferences, rateLimiting: rate } = deps;
  const queries = deps.queries;
  const publicUrl = deps.publicUrl;
  const origin = publicUrl ? new URL(publicUrl).origin : undefined;
  if (publicUrl) {
    const url = new URL(publicUrl);
    if (
      url.pathname !== '/mcp' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    ) {
      throw new Error('KONDIS_MCP_PUBLIC_URL must be an HTTPS URL ending in /mcp (HTTP is allowed on loopback)');
    }
  }
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    const requestOrigin = c.req.header('Origin');
    if (requestOrigin && requestOrigin !== origin) {
      throw new ForbiddenException('Origin is not allowed');
    }
    if (!c.req.path.startsWith('/connections') && !c.req.path.startsWith('/api/v1/connections')) {
      if (!publicUrl) {
        return c.json({ message: 'MCP requires KONDIS_MCP_PUBLIC_URL' }, 503);
      }
      const forwardedHost = deps.trustProxyHeaders ? c.req.header('X-Forwarded-Host') : undefined;
      const host = forwardedHost ?? c.req.header('Host') ?? new URL(c.req.url).host;
      if (host !== new URL(publicUrl).host) {
        throw new ForbiddenException('Host is not allowed');
      }
    }
    await next();
  });
  app.onError((error, c) => {
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 500;
    const headers = error instanceof HttpException ? error.getHeaders() : undefined;
    for (const [key, value] of Object.entries(headers ?? {})) {
      c.header(key, value);
    }
    return c.json(
      {
        message:
          status === 500 ? 'Internal server error' : error instanceof z.ZodError ? 'Invalid arguments' : error.message,
      },
      status as 400,
    );
  });

  app.use('/mcp*', async (c, next) => {
    let principal: Principal | undefined;
    if (deps.demoMode && deps.demoUserId) {
      // In the case of demo mode, we automatically authenticate the demo user but only allow read-only queries
      principal = {
        userId: deps.demoUserId,
        credentialId: null,
        demo: true,
        scopes: new Set(['profile:read', 'activities:read']),
      };
    } else {
      const secret = c.req.header('Authorization')?.replace(/^Bearer /, '');
      if (secret) {
        principal = await keys.authenticate(secret, publicUrl!);
      }
    }
    if (!principal) {
      c.header(
        'WWW-Authenticate',
        `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="activities:read"`,
      );
      return c.json({ message: 'A valid MCP credential is required' }, 401);
    }
    await rate.consume(principal.userId, { label: 'McpUser', maxAttempts: 240, windowMs: 60_000 });
    await rate.consume(principal.credentialId ?? principal.userId, {
      label: 'McpCredential',
      maxAttempts: 120,
      windowMs: 60_000,
    });
    c.set('principal', principal);
    await next();
  });
  app.post('/mcp', async (c) => {
    const parsedBody = JSON.parse(new TextDecoder().decode(await readBounded(c.req.raw, 64 * 1024)));
    if (Array.isArray(parsedBody)) {
      throw new BadRequestException('Batch requests are not supported');
    }
    const principal = c.get('principal');
    if (parsedBody?.method === 'tools/call' && typeof parsedBody.params?.name === 'string') {
      const operationId = z.string().uuid().safeParse(parsedBody.params.arguments?.id).data;
      const required =
        TOOL_SCOPES[parsedBody.params.name] ??
        (parsedBody.params.name === 'get_operation' && operationId
          ? await operations.scopeFor(principal, operationId)
          : undefined);
      const location =
        parsedBody.params.name === 'get_activity_streams' &&
        Array.isArray(parsedBody.params.arguments?.types) &&
        parsedBody.params.arguments.types.some((type: unknown) => type === 'latitude' || type === 'longitude');
      const missing = [required, ...(location ? ['location:read' as const] : [])].filter(
        (scope) => scope && !principal.scopes.has(scope),
      );
      if (missing.length > 0) {
        const requestedScopes = SCOPES.filter((scope) => principal.scopes.has(scope) || missing.includes(scope));
        c.header(
          'WWW-Authenticate',
          `Bearer error="insufficient_scope", scope="${requestedScopes.join(' ')}", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
        );
        return c.json({ message: 'Additional permission is required', scopes: missing }, 403);
      }
    }
    const server = createMcpServer(principal, {
      queries,
      operations: deps.mutationsEnabled && !deps.demoMode ? operations : undefined,
      importEnabled: Boolean(deps.storage),
      consumeAnalysis: () =>
        rate.consume(principal.userId, { label: 'McpAnalysis', maxAttempts: 20, windowMs: 60_000 }),
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(c.req.raw, { parsedBody });
      // Materialize JSON before closing request-scoped Worker dependencies.
      return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
    } finally {
      await server.close();
    }
  });
  app.get('/mcp', (c) => {
    c.header('Allow', 'POST');
    return c.body(null, 405);
  });
  app.post('/mcp/uploads', async (c) => {
    if (!deps.mutationsEnabled || deps.demoMode || !deps.storage) {
      throw new ForbiddenException('Imports are unavailable');
    }
    return c.json(
      await operations.stage(
        c.get('principal'),
        c.req.header('X-Filename') ?? '',
        await readBounded(c.req.raw, 20 * 1024 * 1024),
      ),
      201,
    );
  });

  const management = new Hono<{ Variables: { sessionUserId: string } }>();
  management.use('*', async (c, next) => {
    if (deps.demoMode) {
      throw new ForbiddenException('Connections are unavailable in the demo');
    }
    const secret = getAccessToken({ authorization: c.req.header('Authorization'), cookie: c.req.header('Cookie') });
    const session = secret && (await deps.sessions.findSession(secret));
    if (!session) {
      throw new UnauthorizedException('Sign in is required');
    }
    if (!['GET', 'HEAD'].includes(c.req.method) && !c.req.header('Content-Type')?.startsWith('application/json')) {
      throw new BadRequestException('Use application/json');
    }
    await rate.consume(session.user.id, { label: 'McpManagement', maxAttempts: 30, windowMs: 60_000 });
    c.set('sessionUserId', session.user.id);
    await next();
  });
  management.get('/', async (c) =>
    c.json({ connections: await keys.list(c.get('sessionUserId')), endpoint: publicUrl ?? null, scopes: SCOPES }),
  );
  management.post('/', async (c) =>
    c.json(await keys.create(c.get('sessionUserId'), CreateKeySchema.parse(await json(c.req.raw))), 201),
  );
  management.delete('/:id', async (c) => {
    await keys.revoke(c.get('sessionUserId'), z.string().uuid().parse(c.req.param('id')));
    return c.body(null, 204);
  });
  management.get('/preferences', async (c) => c.json(await preferences.get(c.get('sessionUserId'))));
  management.put('/preferences', async (c) => {
    return c.json(await preferences.update(c.get('sessionUserId'), await json(c.req.raw)));
  });
  management.get('/authorize', async (c) => {
    if (!oauth) {
      throw new BadRequestException('MCP is not configured');
    }
    return c.json(await oauth.validate(AuthorizationSchema.parse(c.req.query())));
  });
  management.post('/authorize', async (c) => {
    if (!oauth) {
      throw new BadRequestException('MCP is not configured');
    }
    const v = z.object({ request: AuthorizationSchema, allow: z.boolean() }).parse(await json(c.req.raw));
    return c.json({ redirect: await oauth.authorize(c.get('sessionUserId'), v.request, v.allow) });
  });
  app.route('/api/v1/connections', management);
  app.route('/connections', management);

  app.get('/.well-known/oauth-protected-resource/mcp', (c) =>
    c.json({
      resource: publicUrl,
      authorization_servers: [origin],
      scopes_supported: ['activities:read'],
      bearer_methods_supported: ['header'],
    }),
  );
  app.get('/.well-known/oauth-authorization-server', (c) =>
    c.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      revocation_endpoint: `${origin}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: SCOPES,
      authorization_response_iss_parameter_supported: true,
    }),
  );
  app.use('/oauth/*', async (c, next) => {
    if (deps.demoMode) {
      throw new ForbiddenException('OAuth is unavailable in the demo');
    }
    const endpoint =
      c.req.path === '/oauth/register' ? 'Register' : c.req.path === '/oauth/token' ? 'Token' : 'Authorize';
    const clientId = requestClientId(c, deps.trustProxyHeaders ?? false);
    await rate.consume(`${endpoint}:${clientId}`, {
      label: `McpOAuth${endpoint}`,
      maxAttempts: 60,
      windowMs: 60_000,
    });
    await next();
  });
  app.get('/oauth/authorize', async (c) => {
    await oauth!.validate(AuthorizationSchema.parse(c.req.query()));
    return c.redirect(`${origin}/settings/connections/authorize?${new URL(c.req.url).searchParams.toString()}`);
  });
  app.post('/oauth/register', async (c) =>
    c.json(await oauth!.register(RegistrationSchema.parse(await json(c.req.raw))), 201),
  );
  app.post('/oauth/token', async (c) => {
    try {
      const form = Object.fromEntries(
        new URLSearchParams(new TextDecoder().decode(await readBounded(c.req.raw, 16 * 1024))),
      );
      return c.json(await oauth!.exchange(form));
    } catch {
      return c.json({ error: 'invalid_grant' }, 400);
    }
  });
  app.post('/oauth/revoke', async (c) => {
    const form = z
      .object({ token: z.string().max(200), client_id: z.string().max(200) })
      .parse(
        Object.fromEntries(new URLSearchParams(new TextDecoder().decode(await readBounded(c.req.raw, 16 * 1024)))),
      );
    await oauth!.revoke(form.token, form.client_id);
    return c.body(null, 200);
  });
  return app;
}
