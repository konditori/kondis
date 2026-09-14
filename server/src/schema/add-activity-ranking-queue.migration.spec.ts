import { beforeEach, describe, expect, it, vi } from 'vitest';

const { statements } = vi.hoisted(() => ({ statements: [] as string[] }));

vi.mock('kysely', () => ({
  sql: (fragments: TemplateStringsArray, ...parameters: unknown[]) => ({
    execute: vi.fn(() => {
      statements.push(String.raw({ raw: fragments }, ...parameters));
      return Promise.resolve();
    }),
  }),
}));

import { down, up } from 'src/schema/migrations/1789658664158-AddActivityRankingQueue';

const compact = (statement: string): string => statement.replaceAll(/\s+/g, ' ').trim();

describe('AddActivityRankingQueue migration', () => {
  beforeEach(() => {
    statements.length = 0;
  });

  it('moves ranking jobs into their own exclusive queue', async () => {
    await up({} as never);

    const output = statements.map((statement) => compact(statement)).join('\n');
    expect(output).toContain("SET queue = 'activityRanking'");
    expect(output).toContain("queue = 'activityRanking' AND name = 'ActivityBestEffortRank'");
  });

  it('restores the enrichment queue on rollback', async () => {
    await down({} as never);

    const output = statements.map((statement) => compact(statement)).join('\n');
    expect(output).toContain("SET queue = 'activityEnrichment'");
    expect(output).toContain("'ActivityBestEffortRank'");
  });
});
