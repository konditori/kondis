import { describe, expect, it } from 'vitest';

import { runtimeRoleForDemoDatabase } from 'src/demo/database-lifecycle';

describe('runtimeRoleForDemoDatabase', () => {
  it('maps the main demo database to its stable role', () => {
    expect(runtimeRoleForDemoDatabase('kondis-demo')).toBe('kondis_runtime');
  });

  it('maps a PR database to an isolated role', () => {
    expect(runtimeRoleForDemoDatabase('kondis-demo-pr-42')).toBe('kondis_demo_pr_42');
  });

  it.each(['kondis', 'kondis-demo-pr-0', 'kondis-demo-pr-01', 'kondis-demo-pr-x', 'production'])(
    'rejects unsafe database name %s',
    (databaseName) => {
      expect(() => runtimeRoleForDemoDatabase(databaseName)).toThrow(/Refusing to manage non-demo database/);
    },
  );
});
