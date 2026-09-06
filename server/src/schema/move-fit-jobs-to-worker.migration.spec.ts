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

import { down, up } from 'src/schema/migrations/1788558664155-MoveFitJobsToWorker';

const FIT_JOB_NAMES = [
  'ActivityUpload',
  'ActivityParse',
  'ActivityMetricCompute',
  'ActivityBestEffortCompute',
  'ActivityBestEffortRank',
  'ActivityRouteMatchCompute',
];
const compact = (statement: string): string => statement.replaceAll(/\s+/g, ' ').trim();

describe('MoveFitJobsToWorker migration', () => {
  beforeEach(() => {
    statements.length = 0;
  });

  it('replaces only the legacy ownership check and republishes pending FIT jobs', async () => {
    await up({} as never);

    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain('FROM pg_constraint');
    expect(statements[0]).toContain('pg_get_constraintdef(c.oid)');
    expect(statements[0]).toContain("CHECKconsumer=''worker''ANDname=''AuthCredentialCleanup''");
    expect(statements[0]).toContain('cardinality(ownership_constraint_names), 0) <> 1');

    const update = compact(statements[1]);
    expect(update).toContain("SET consumer = 'worker'");
    expect(update).toContain("WHEN state IN ('created', 'retry') THEN NULL ELSE published_on END");
    for (const jobName of FIT_JOB_NAMES) {
      expect(update).toContain(`'${jobName}'`);
    }

    const constraint = compact(statements[2]);
    expect(constraint).toContain('ADD CONSTRAINT background_job_consumer_ownership_check CHECK');
    expect(constraint).toContain("consumer = 'worker'");
    expect(constraint).toContain("consumer = 'node'");
  });

  it('restores Node ownership without changing publication history', async () => {
    await down({} as never);

    expect(statements).toHaveLength(3);
    expect(compact(statements[0])).toContain('DROP CONSTRAINT background_job_consumer_ownership_check');
    expect(compact(statements[1])).toContain("SET consumer = 'node'");
    expect(statements[1]).not.toContain('published_on');
    expect(compact(statements[2])).toContain(
      "(consumer = 'worker' AND name = 'AuthCredentialCleanup') OR (consumer = 'node' AND name <> 'AuthCredentialCleanup')",
    );
  });
});
