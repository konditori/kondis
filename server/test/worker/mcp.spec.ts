/// <reference types="@cloudflare/vitest-plugin/types" />

import { createMcpApp, type McpDependencies } from 'src/mcp/app';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { ActivityQueryService } from 'src/services/activity-query.service';
import { newServiceDeps } from 'test/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('MCP inside workerd', () => {
  afterEach(() => vi.restoreAllMocks());
  it('serves discovery and a read tool over POST with request-scoped dependencies', async () => {
    vi.spyOn(RateLimitingRepository.prototype, 'consume').mockResolvedValue();
    const search = vi
      .spyOn(ActivityQueryService.prototype, 'search')
      .mockResolvedValue({ activities: [], nextCursor: null, units: {} as never });
    const app = createMcpApp({
      database: {},
      queries: new ActivityQueryService(newServiceDeps({})),
      sessions: {},
      jobs: {},
      publicUrl: 'https://fitness.example/mcp',
      demo: true,
      demoUserId: '00000000-0000-4000-8000-000000000001',
    } as unknown as McpDependencies);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    const discovery = await app.request('https://fitness.example/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const catalog = await discovery.json();
    expect(catalog.result.tools.map((tool: { name: string }) => tool.name)).toContain('summarize_training');
    const response = await app.request('https://fitness.example/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'search_activities', arguments: { limit: 2 } },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { structuredContent: { data: { activities: [] } } } });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ demo: true }), { limit: 2 });
  });
});
