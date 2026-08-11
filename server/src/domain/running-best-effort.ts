export const RUNNING_BEST_EFFORTS = [
  { type: '400m', label: '400 m', distance: 400 },
  { type: '1k', label: '1K', distance: 1000 },
  { type: 'half_mile', label: '½ mile', distance: 804.672 },
  { type: '1_mile', label: '1 mile', distance: 1609.344 },
  { type: '2_miles', label: '2 miles', distance: 3218.688 },
  { type: '5k', label: '5K', distance: 5000 },
  { type: '10k', label: '10K', distance: 10_000 },
  { type: '15k', label: '15K', distance: 15_000 },
  { type: '10_miles', label: '10 miles', distance: 16_093.44 },
  { type: '20k', label: '20K', distance: 20_000 },
  { type: 'half_marathon', label: 'Half marathon', distance: 21_097.5 },
  { type: '30k', label: '30K', distance: 30_000 },
  { type: 'marathon', label: 'Marathon', distance: 42_195 },
  { type: '50k', label: '50K', distance: 50_000 },
] as const;

export type RunningBestEffortType = (typeof RUNNING_BEST_EFFORTS)[number]['type'];

export type RunningBestEffort = {
  type: RunningBestEffortType;
  distance: number;
  elapsedTime: number;
  startTime: number;
  endTime: number;
};

type DistanceTimePoint = { distance: number; time: number };

const buildPoints = (distance: number[], time: number[]): DistanceTimePoint[] => {
  const points: DistanceTimePoint[] = [];
  let previousRawDistance: number | undefined;
  let previousDistance = 0;
  let offset = 0;

  for (let index = 0; index < Math.min(distance.length, time.length); index++) {
    const rawDistance = distance[index];
    const sampleTime = time[index];
    if (!Number.isFinite(rawDistance) || !Number.isFinite(sampleTime) || rawDistance < 0) {
      continue;
    }

    const previous = points.at(-1);
    if (previous && sampleTime <= previous.time) {
      continue;
    }

    // Some formats reset cumulative distance at each lap. Unroll those resets while
    // clamping small device/GPS regressions so the resulting series stays monotonic.
    const isLapReset =
      previousRawDistance !== undefined && previousRawDistance > 100 && rawDistance < previousRawDistance * 0.25;
    if (isLapReset) {
      offset = previousDistance - rawDistance;
    }

    const normalizedDistance = Math.max(previousDistance, rawDistance + offset);
    points.push({ distance: normalizedDistance, time: sampleTime });
    previousRawDistance = rawDistance;
    previousDistance = normalizedDistance;
  }

  return points;
};

const interpolateTime = (before: DistanceTimePoint, after: DistanceTimePoint, distance: number): number => {
  if (distance <= before.distance || after.distance === before.distance) {
    return before.time;
  }
  if (distance >= after.distance) {
    return after.time;
  }

  const ratio = (distance - before.distance) / (after.distance - before.distance);
  return before.time + ratio * (after.time - before.time);
};

const fastestEffort = (
  points: DistanceTimePoint[],
  type: RunningBestEffortType,
  targetDistance: number,
): RunningBestEffort | undefined => {
  if (points.length < 2 || points.at(-1)!.distance - points[0].distance < targetDistance) {
    return;
  }

  let best: RunningBestEffort | undefined;
  const consider = (startTime: number, endTime: number): void => {
    const elapsedTime = endTime - startTime;
    if (!Number.isFinite(elapsedTime) || elapsedTime <= 0 || (best && elapsedTime >= best.elapsedTime)) {
      return;
    }
    best = { type, distance: targetDistance, elapsedTime, startTime, endTime };
  };

  // Candidate windows whose start is a recorded sample and whose end is interpolated.
  let endIndex = 1;
  for (let startIndex = 0; startIndex < points.length - 1; startIndex++) {
    const targetEndDistance = points[startIndex].distance + targetDistance;
    endIndex = Math.max(endIndex, startIndex + 1);
    while (endIndex < points.length && points[endIndex].distance < targetEndDistance) {
      endIndex++;
    }
    if (endIndex >= points.length) {
      break;
    }

    consider(points[startIndex].time, interpolateTime(points[endIndex - 1], points[endIndex], targetEndDistance));
  }

  // Also consider windows whose end is a recorded sample. The optimum of a
  // piecewise-linear trace can occur at either side of a sample boundary.
  let startIndex = 0;
  for (let currentEndIndex = 1; currentEndIndex < points.length; currentEndIndex++) {
    const targetStartDistance = points[currentEndIndex].distance - targetDistance;
    if (targetStartDistance < points[0].distance) {
      continue;
    }

    while (startIndex + 1 < currentEndIndex && points[startIndex + 1].distance <= targetStartDistance) {
      startIndex++;
    }

    consider(
      interpolateTime(points[startIndex], points[startIndex + 1], targetStartDistance),
      points[currentEndIndex].time,
    );
  }

  return best;
};

export const computeRunningBestEfforts = (distance: number[], time: number[]): RunningBestEffort[] => {
  const points = buildPoints(distance, time);
  return RUNNING_BEST_EFFORTS.flatMap(({ type, distance: targetDistance }) => {
    const effort = fastestEffort(points, type, targetDistance);
    return effort ? [effort] : [];
  });
};

export const runningBestEffortLabel = (type: RunningBestEffortType): string =>
  RUNNING_BEST_EFFORTS.find((effort) => effort.type === type)?.label ?? type;
