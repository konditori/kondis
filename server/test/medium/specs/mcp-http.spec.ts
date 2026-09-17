import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { JobRepository } from 'src/contracts/job.repository';
import { createMcpApp } from 'src/mcp/app';
import { McpOAuthService } from 'src/mcp/oauth';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { McpCredentialRepository } from 'src/repositories/mcp-credential.repository';
import { McpOAuthRepository } from 'src/repositories/mcp-oauth.repository';
import { McpOperationRepository } from 'src/repositories/mcp-operation.repository';
import { McpPreferenceRepository } from 'src/repositories/mcp-preference.repository';
import { PostgresTransactionRepository } from 'src/repositories/postgres-transaction.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { ActivityUploadService } from 'src/services/activity-upload.service';
import { ActivityService } from 'src/services/activity.service';
import { ApiKeyService } from 'src/services/api-key.service';
import { McpPreferenceService } from 'src/services/mcp-preference.service';
import { OperationService } from 'src/services/operation.service';
import { createMediumFactory } from 'test/medium.factory';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';
import { newServiceDeps } from 'test/utils';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('MCP HTTP with PostgreSQL', () => {
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(() => {
    db = createMediumTestDatabase();
  });
  beforeEach(async () => {
    await resetMediumTestDatabase(db);
  });
  afterAll(async () => {
    await db?.destroy();
  });

  it('authenticates a stored API key and returns only its owner activity through the MCP client', async () => {
    const factory = createMediumFactory(db);
    const owner = await factory.newUser();
    const other = await factory.newUser();
    await factory.newActivity(owner.id, new Date('2026-03-29T08:00:00Z'), 'Owner run');
    await factory.newActivity(other.id, new Date('2026-03-29T08:00:00Z'), 'Other run');

    const transactions = new PostgresTransactionRepository(db);
    const credentials = new McpCredentialRepository(db);
    const keys = new ApiKeyService(credentials, transactions);
    const key = await keys.create(owner.id, { name: 'MCP medium test', scopes: ['activities:read'], expiresInDays: 1 });
    const jobs = {
      queue: vi.fn().mockResolvedValue(undefined),
      queueAll: vi.fn().mockResolvedValue(undefined),
      discardQueuedDuplicates: vi.fn().mockResolvedValue(undefined),
    } as unknown as JobRepository;
    const queries = new ActivityQueryService(
      newServiceDeps({
        activityRepository: new ActivityRepository(db),
        mcpPreferenceRepository: new McpPreferenceRepository(db),
        userRepository: new UserRepository(db),
      }),
    );
    const operations = new OperationService(
      new McpOperationRepository(db),
      transactions,
      new ActivityService(
        newServiceDeps({
          activityRepository: new ActivityRepository(db),
          databaseRepository: transactions,
          jobRepository: jobs,
          uploadRepository: new UploadRepository(db),
        }),
      ),
      new ActivityUploadService(new UploadRepository(db), jobs),
    );
    const app = createMcpApp({
      queries,
      sessions: {} as never,
      keys,
      operations,
      oauth: new McpOAuthService(new McpOAuthRepository(db), credentials, transactions, 'https://fitness.example/mcp'),
      preferences: new McpPreferenceService(new McpPreferenceRepository(db)),
      rateLimiting: new RateLimitingRepository(db),
      publicUrl: 'https://fitness.example/mcp',
      mutationsEnabled: true,
    });
    const client = new Client({ name: 'medium-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://fitness.example/mcp'), {
      requestInit: { headers: { Authorization: `Bearer ${key.secret}` } },
      fetch: async (input, init) => app.fetch(new Request(input, init)),
    });

    await client.connect(transport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain('search_activities');
      const result = await client.callTool({ name: 'search_activities', arguments: { limit: 10 } });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        data: { activities: [expect.objectContaining({ name: 'Owner run' })] },
      });
      expect(result.structuredContent).not.toMatchObject({
        data: { activities: [expect.objectContaining({ name: 'Other run' })] },
      });
    } finally {
      await client.close();
    }
  });
});
