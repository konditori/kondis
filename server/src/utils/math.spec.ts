import { describe, expect, it } from 'vitest';

import { max, mean, rollingAverage } from 'src/utils/math';

describe('mean / max', () => {
  it('ignores non-finite samples so a sensor dropout cannot poison the result', () => {
    expect(mean([10, NaN, 20])).toBe(15);
    expect(max([10, NaN, 20])).toBe(20);
  });

  it('returns null when nothing usable is present', () => {
    expect(mean([])).toBeNull();
    expect(mean([NaN])).toBeNull();
    expect(max([NaN])).toBeNull();
  });
});

describe('rollingAverage', () => {
  it('ramps up over the leading partial window', () => {
    expect(rollingAverage([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
  });

  it('is a no-op for a window of one', () => {
    expect(rollingAverage([5, 6], 1)).toEqual([5, 6]);
  });
});
