import { describe, expect, it, vi } from 'vitest';

import { ConsoleLogger } from 'src/logger';

describe(ConsoleLogger.name, () => {
  it('suppresses disabled log levels', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});

    new ConsoleLogger({ logLevels: [] }).log('hidden');

    expect(output).not.toHaveBeenCalled();
    output.mockRestore();
  });
});
