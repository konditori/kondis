import { rollingAverage } from 'src/utils/math';

export type ElevationChange = { gainM: number; lossM: number };

export type ElevationOptions = {
  thresholdM?: number;
  sampleIntervalS?: number;
};

const ELEVATION_SMOOTHING_WINDOW_S = 30;
const ELEVATION_THRESHOLD_M = 3;
const NORMALIZED_POWER_WINDOW_S = 30;

export const inferSampleInterval = (time: number[]): number => {
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

export const computeMovingTime = (speed: number[], time: number[], thresholdMps = 0.5): number | null => {
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

export const computeElevationChange = (altitude: number[], options: ElevationOptions = {}): ElevationChange => {
  const { thresholdM = ELEVATION_THRESHOLD_M, sampleIntervalS = 1 } = options;

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
