import { describe, expect, it } from 'vitest';

import {
  computeElevationChange,
  computeMovingTimeS,
  computeNormalizedPower,
  inferSampleIntervalS,
  max,
  mean,
  rollingAverage,
} from 'src/domain/activity/metrics';

describe('mean / max', () => {
  it('ignores non-finite samples so a sensor dropout cannot poison the result', () => {
    expect(mean([10, Number.NaN, 20])).toBe(15);
    expect(max([10, Number.NaN, 20])).toBe(20);
  });

  it('returns null when nothing usable is present', () => {
    expect(mean([])).toBeNull();
    expect(mean([Number.NaN])).toBeNull();
    expect(max([Number.NaN])).toBeNull();
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

describe('computeNormalizedPower', () => {
  it('equals average power for a perfectly steady effort', () => {
    expect(computeNormalizedPower(Array.from({ length: 120 }, () => 200))).toBe(200);
  });

  it('exceeds average power for a variable effort, which is the whole point', () => {
    const surging = Array.from({ length: 600 }, (_, index) => (index % 60 < 30 ? 100 : 300));
    const normalized = computeNormalizedPower(surging);
    expect(normalized).not.toBeNull();
    expect(normalized as number).toBeGreaterThan(200);
  });

  it('returns null without power data', () => {
    expect(computeNormalizedPower([])).toBeNull();
  });

  it('scales the 30s window by the sample interval', () => {
    // At 5s sampling the window is 6 samples, not 30.
    expect(computeNormalizedPower(Array.from({ length: 50 }, () => 150), 5)).toBe(150);
  });
});

describe('computeElevationChange', () => {
  it('ignores jitter below the threshold', () => {
    expect(computeElevationChange([100, 100.5, 102, 101, 105], 1)).toEqual({ gainM: 6, lossM: 1 });
  });

  it('reports nothing for a stationary barometric drift', () => {
    expect(computeElevationChange([50, 50.2, 49.9, 50.1], 1)).toEqual({ gainM: 0, lossM: 0 });
  });
});

describe('computeMovingTimeS', () => {
  it('excludes samples below the speed threshold', () => {
    expect(computeMovingTimeS([0, 2, 2, 0, 3], [0, 1, 2, 3, 4])).toBe(3);
  });

  it('returns null without speed data', () => {
    expect(computeMovingTimeS([], [])).toBeNull();
  });
});

describe('inferSampleIntervalS', () => {
  it('takes the median so a recording gap does not skew it', () => {
    expect(inferSampleIntervalS([0, 1, 2, 60, 61])).toBe(1);
  });

  it('defaults to one second when there is nothing to infer from', () => {
    expect(inferSampleIntervalS([])).toBe(1);
    expect(inferSampleIntervalS([5])).toBe(1);
  });
});
