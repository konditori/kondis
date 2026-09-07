import { describe, expect, it } from 'vitest';

import { DEMO_FIT_SPECS, createDemoFitFile } from 'src/demo/fit';
import { ConsoleLogger } from 'src/logger';
import { FitRepository } from 'src/repositories/fit.repository';
import { parseFitMessages } from 'src/utils/fit';

describe('demo FIT fixtures', () => {
  it('generates parser-compatible files with route and analysis data', () => {
    const spec = DEMO_FIT_SPECS[0];
    const messages = new FitRepository(new ConsoleLogger()).decode(createDemoFitFile(spec));
    const parsed = parseFitMessages(messages);

    expect(parsed.sport).toBe(spec.activitySport);
    expect(parsed.distance).toBeCloseTo(spec.distanceM, 0);
    expect(messages.recordMesgs?.length).toBeGreaterThan(60);
    expect(parsed.streams.some(({ type }) => type === 'latitude')).toBe(true);
    expect(parsed.streams.some(({ type }) => type === 'longitude')).toBe(true);
  });
});
