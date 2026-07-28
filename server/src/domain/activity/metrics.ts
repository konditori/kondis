/**
 * Pure derived-metric maths. No I/O, no framework, no database.
 *
 * These are the functions that will grow into the expensive part of the system (best-effort
 * curves, training load), which is exactly why they live here: fully unit-testable in
 * isolation, and callable from a job handler without dragging infrastructure along.
 */

const NORMALIZED_POWER_WINDOW_S = 30;

/**
 * Non-finite samples are skipped throughout, so a sensor dropout cannot poison a result.
 *
 * Written as explicit loops rather than reduce/spread deliberately: a long activity can hold
 * tens of thousands of samples, and `Math.max(...values)` overflows the call stack well before
 * that. These also allocate nothing.
 */
export const mean = (values: number[]): number | null => {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }

    total += value;
    count++;
  }
  return count === 0 ? null : total / count;
};

export const max = (values: number[]): number | null => {
  let result: number | null = null;
  for (const value of values) {
    if (Number.isFinite(value) && (result === null || value > result)) {
      result = value;
    }
  }
  return result;
};

/**
 * Rolling average over a fixed sample count. Used as the first stage of normalized power.
 */
export const rollingAverage = (values: number[], windowSize: number): number[] => {
  if (windowSize <= 1 || values.length === 0) {
    return [...values];
  }

  const result: number[] = [];
  let sum = 0;
  for (let index = 0; index < values.length; index++) {
    const value = Number.isFinite(values[index]) ? values[index] : 0;
    sum += value;

    if (index >= windowSize) {
      const leaving = Number.isFinite(values[index - windowSize]) ? values[index - windowSize] : 0;
      sum -= leaving;
    }

    const count = Math.min(index + 1, windowSize);
    result.push(sum / count);
  }

  return result;
};

/**
 * Normalized Power: 30-second rolling average, then the fourth root of the mean of fourth
 * powers. Weights hard efforts more heavily than a plain average, which is the point.
 *
 * `sampleIntervalS` is the spacing between power samples, so the 30s window is expressed in
 * samples rather than assuming 1Hz recording.
 */
export const computeNormalizedPower = (power: number[], sampleIntervalS = 1): number | null => {
  if (power.length === 0 || sampleIntervalS <= 0) {
    return null;
  }

  const windowSize = Math.max(1, Math.round(NORMALIZED_POWER_WINDOW_S / sampleIntervalS));
  const smoothed = rollingAverage(power, windowSize);
  if (smoothed.length === 0) {
    return null;
  }

  let total = 0;
  for (const value of smoothed) {
    total += value ** 4;
  }

  return Math.round((total / smoothed.length) ** 0.25);
};

export type ElevationChange = { gainM: number; lossM: number };

export type ElevationOptions = {
  /** Deltas smaller than this are treated as noise. */
  thresholdM?: number;
  /** Spacing between altitude samples, used to size the smoothing window in real time. */
  sampleIntervalS?: number;
};

const ELEVATION_SMOOTHING_WINDOW_S = 30;
const ELEVATION_THRESHOLD_M = 3;

/**
 * Smooths altitude, then sums the deltas that exceed `thresholdM`.
 *
 * Both stages are necessary. GPS and barometric altitude jitter by metres at rest, and naive
 * accumulation turns that noise into enormous phantom climbing: on the Hindås 10k fixture,
 * whose altitude range is only 70m, raw accumulation reports 694m of gain. Smoothing over 30s
 * before applying a 3m threshold brings that to roughly 200-285m.
 *
 * The smoothing window is expressed in seconds and converted using `sampleIntervalS`, so a
 * device recording every 9 seconds and one recording every second get the same treatment.
 *
 * NOTE: these defaults are reasoned, not validated. Tuning them against activities with known
 * elevation is worthwhile before anyone trusts the number.
 */
export const computeElevationChange = (altitude: number[], options: ElevationOptions = {}): ElevationChange => {
  const { thresholdM = ELEVATION_THRESHOLD_M, sampleIntervalS = 1 } = options;

  // Non-finite samples are removed *before* smoothing. rollingAverage treats them as zero,
  // which would otherwise read as an instantaneous drop to sea level.
  const usable = altitude.filter((value) => Number.isFinite(value));
  if (usable.length === 0) {
    return { gainM: 0, lossM: 0 };
  }

  const windowSize = Math.max(1, Math.round(ELEVATION_SMOOTHING_WINDOW_S / Math.max(sampleIntervalS, 1)));
  const smoothed = rollingAverage(usable, windowSize);

  let gainM = 0;
  let lossM = 0;
  let reference = smoothed[0];

  for (const value of smoothed) {
    const delta = value - reference;
    if (Math.abs(delta) < thresholdM) {
      continue;
    }

    if (delta > 0) {
      gainM += delta;
    } else {
      lossM -= delta;
    }
    reference = value;
  }

  return { gainM, lossM };
};

/**
 * Time spent above a speed threshold, i.e. elapsed time minus stops. Falls back to counting
 * samples when no time stream is available.
 */
export const computeMovingTimeS = (speed: number[], time: number[], thresholdMps = 0.5): number | null => {
  if (speed.length === 0) {
    return null;
  }

  let movingS = 0;
  for (let index = 1; index < speed.length; index++) {
    if (!Number.isFinite(speed[index]) || speed[index] < thresholdMps) {
      continue;
    }

    const delta = time.length > index ? time[index] - time[index - 1] : 1;
    if (Number.isFinite(delta) && delta > 0) {
      movingS += delta;
    }
  }

  return Math.round(movingS);
};

/** Median spacing between samples. Robust against gaps, unlike a mean. */
export const inferSampleIntervalS = (time: number[]): number => {
  if (time.length < 2) {
    return 1;
  }

  const deltas: number[] = [];
  for (let index = 1; index < time.length; index++) {
    const delta = time[index] - time[index - 1];
    if (Number.isFinite(delta) && delta > 0) {
      deltas.push(delta);
    }
  }

  if (deltas.length === 0) {
    return 1;
  }

  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
};
