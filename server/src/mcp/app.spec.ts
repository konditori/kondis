import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpApp, readBounded, type McpDependencies } from 'src/mcp/app';
import { requireScope, type Principal } from 'src/mcp/context';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { ApiKeyService } from 'src/services/api-key.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const principal: Principal = {
  userId: '00000000-0000-4000-8000-000000000001',
  credentialId: '00000000-0000-4000-8000-000000000002',
  scopes: new Set(['activities:read']),
};
const dependencies = () =>
  ({
    database: {},
    sessions: { findSession: vi.fn() },
    jobs: {},
    publicUrl: 'https://fitness.example/mcp',
    mutationsEnabled: true,
  }) as unknown as McpDependencies;

describe('MCP HTTP boundary', () => {
  beforeEach(() => {
    vi.spyOn(RateLimitingRepository.prototype, 'consume').mockResolvedValue();
    vi.spyOn(ApiKeyService.prototype, 'authenticate').mockImplementation((secret) =>
      Promise.resolve(secret === 'valid' ? principal : undefined),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('connects the official HTTP client, discovers tools, reads resources and calls a tool', async () => {
    const search = vi
      .spyOn(ActivityQueryService.prototype, 'search')
      .mockResolvedValue({ activities: [], nextCursor: null, units: {} as never });
    const app = createMcpApp(dependencies());
    const client = new Client({ name: 'integration-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://fitness.example/mcp'), {
      requestInit: { headers: { Authorization: 'Bearer valid' } },
      fetch: async (input, init) => app.fetch(new Request(input, init)),
    });
    await client.connect(transport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain('summarize_training');
      expect(tools.tools.map((tool) => tool.name)).not.toContain('update_activity');
      const result = await client.callTool({ name: 'search_activities', arguments: { limit: 5 } });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ data: { activities: [] }, calculationVersion: '1' });
      expect(search).toHaveBeenCalledWith(principal, { limit: 5 });
      const definitions = await client.readResource({ uri: 'kondis://metrics' });
      expect(definitions.contents[0]).toMatchObject({ mimeType: 'application/json' });
      const prompt = await client.getPrompt({
        name: 'weekly_training_review',
        arguments: { request: 'Review last week' },
      });
      expect(prompt.messages).toHaveLength(1);
    } finally {
      await client.close();
    }
  });

  it('rejects invalid credentials and advertises OAuth discovery', async () => {
    const app = createMcpApp(dependencies());
    const response = await app.request('https://fitness.example/mcp', {
      method: 'POST',
      headers: { Cookie: 'kondis_session=valid' },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('/.well-known/oauth-protected-resource/mcp');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    const metadata = await app.request('https://fitness.example/.well-known/oauth-authorization-server');
    expect(await metadata.json()).toMatchObject({ code_challenge_methods_supported: ['S256'] });
  });

  it('rejects origins, host rebinding, oversized and batch requests', async () => {
    const app = createMcpApp(dependencies());
    for (const headers of [
      new Headers({ Origin: 'https://attacker.example' }),
      new Headers({ Host: 'attacker.example' }),
    ]) {
      const response = await app.request('https://fitness.example/mcp', { method: 'POST', headers });
      expect(response.status).toBe(403);
    }
    for (const [body, status] of [
      ['x'.repeat(65 * 1024), 413],
      ['[]', 400],
      ['{', 400],
    ] as const) {
      const response = await app.request('https://fitness.example/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid' },
        body,
      });
      expect(response.status).toBe(status);
    }
  });

  it('allows demo reads over POST and hides every mutation', async () => {
    const app = createMcpApp({ ...dependencies(), demo: true, demoUserId: principal.userId });
    const response = await app.request('https://fitness.example/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toContain('search_activities');
    expect(names).not.toContain('create_manual_activity');
    expect(names).not.toContain('start_activity_import');
    const upload = await app.request('https://fitness.example/mcp/uploads', { method: 'POST' });
    expect(upload.status).toBe(403);
  });

  it('enforces location and write scopes in services independently of discovery', () => {
    expect(() => requireScope(principal, 'location:read')).toThrow('location:read');
    expect(() =>
      requireScope({ ...principal, demo: true, scopes: new Set(['activities:write']) }, 'activities:write'),
    ).toThrow();
  });

  it('bounds streamed request bodies without trusting Content-Length', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(20));
        controller.close();
      },
    });
    await expect(
      readBounded(
        new Request('https://fitness.example', { method: 'POST', body: stream, duplex: 'half' } as RequestInit),
        10,
      ),
    ).rejects.toThrow();
  });
});
