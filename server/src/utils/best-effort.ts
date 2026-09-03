import { CYCLING_BEST_EFFORTS, RUNNING_BEST_EFFORTS } from 'src/constants';
import type { BestEffort, BestEffortType, DistanceBestEffortDefinition } from 'src/types';

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
  type: BestEffortType,
  targetDistance: number,
): BestEffort | undefined => {
  if (points.length < 2 || points.at(-1)!.distance - points[0].distance < targetDistance) {
    return;
  }

  let best: BestEffort | undefined;
  const consider = (startTime: number, endTime: number): void => {
    const elapsedTime = endTime - startTime;
    if (!Number.isFinite(elapsedTime) || elapsedTime <= 0 || (best && elapsedTime >= best.elapsedTime)) {
      return;
    }
    best = {
      type,
      distance: targetDistance,
      elapsedTime,
      startTime,
      endTime,
      value: elapsedTime,
      valueKind: 'duration',
    };
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

export const computeDistanceBestEfforts = (
  distance: number[],
  time: number[],
  definitions: readonly DistanceBestEffortDefinition[],
): BestEffort[] => {
  const points = buildPoints(distance, time);
  return definitions.flatMap(({ type, distance: targetDistance }) => {
    const effort = fastestEffort(points, type, targetDistance);
    return effort ? [effort] : [];
  });
};

export const computeRunningBestEfforts = (distance: number[], time: number[]): BestEffort[] =>
  computeDistanceBestEfforts(distance, time, RUNNING_BEST_EFFORTS);

export const computeCyclingBestEfforts = (distance: number[], time: number[]): BestEffort[] =>
  computeDistanceBestEfforts(
    distance,
    time,
    CYCLING_BEST_EFFORTS.filter(
      (effort): effort is (typeof CYCLING_BEST_EFFORTS)[number] & { distance: number } => 'distance' in effort,
    ),
  );

export const computeCyclingSummaryBestEfforts = (summary: {
  distance: number | null;
  elevationGain: number | null;
  elapsedTime: number;
}): BestEffort[] => {
  const efforts: BestEffort[] = [];
  if (summary.distance && summary.distance > 0 && summary.elapsedTime > 0) {
    efforts.push({
      type: 'longest_ride',
      distance: summary.distance,
      elapsedTime: summary.elapsedTime,
      startTime: 0,
      endTime: summary.elapsedTime,
      value: summary.distance,
      valueKind: 'distance',
    });
  }
  if (summary.elevationGain && summary.elevationGain > 0 && summary.elapsedTime > 0) {
    efforts.push({
      type: 'elevation_gain',
      distance: summary.distance ?? 1,
      elapsedTime: summary.elapsedTime,
      startTime: 0,
      endTime: summary.elapsedTime,
      value: summary.elevationGain,
      valueKind: 'elevation',
    });
  }
  return efforts;
};

export const computeBiggestClimb = (altitude: number[], time: number[]): BestEffort | undefined => {
  let minimumAltitude: number | undefined;
  let minimumTime = 0;
  let best: BestEffort | undefined;

  for (let index = 0; index < Math.min(altitude.length, time.length); index++) {
    const currentAltitude = altitude[index];
    const currentTime = time[index];
    if (!Number.isFinite(currentAltitude) || !Number.isFinite(currentTime)) {
      continue;
    }
    if (minimumAltitude === undefined || currentAltitude < minimumAltitude) {
      minimumAltitude = currentAltitude;
      minimumTime = currentTime;
      continue;
    }

    const gain = currentAltitude - minimumAltitude;
    if (gain > (best?.value ?? 0) && currentTime > minimumTime) {
      best = {
        type: 'biggest_climb',
        distance: gain,
        elapsedTime: currentTime - minimumTime,
        startTime: minimumTime,
        endTime: currentTime,
        value: gain,
        valueKind: 'elevation',
      };
    }
  }
  return best;
};

type TimedPower = { time: number; power: number };

const buildTimedPower = (power: number[], time: number[]): TimedPower[] => {
  const points: TimedPower[] = [];
  for (let index = 0; index < Math.min(power.length, time.length); index++) {
    if (!Number.isFinite(time[index]) || (points.length > 0 && time[index] <= points.at(-1)!.time)) {
      continue;
    }
    points.push({ time: time[index], power: power[index] });
  }
  return points;
};

export const computeCyclingPowerBestEfforts = (power: number[], time: number[]): BestEffort[] => {
  const points = buildTimedPower(power, time);
  if (points.length < 2) {
    return [];
  }

  const energy = Array.from({ length: points.length }, () => 0);
  const invalidDuration = Array.from({ length: points.length }, () => 0);
  for (let index = 1; index < points.length; index++) {
    const duration = points[index].time - points[index - 1].time;
    energy[index] =
      energy[index - 1] + (Number.isFinite(points[index - 1].power) ? points[index - 1].power * duration : 0);
    invalidDuration[index] = invalidDuration[index - 1] + (Number.isFinite(points[index - 1].power) ? 0 : duration);
  }

  const cumulativeAt = (targetTime: number): { energy: number; invalidDuration: number } => {
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (points[middle].time <= targetTime) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    const partialDuration = targetTime - points[low].time;
    return {
      energy: energy[low] + (Number.isFinite(points[low].power) ? points[low].power * partialDuration : 0),
      invalidDuration: invalidDuration[low] + (Number.isFinite(points[low].power) ? 0 : partialDuration),
    };
  };

  return CYCLING_BEST_EFFORTS.filter(
    (effort): effort is (typeof CYCLING_BEST_EFFORTS)[number] & { duration: number } => 'duration' in effort,
  ).flatMap(({ type, duration }) => {
    let best: BestEffort | undefined;
    for (let startIndex = 0; startIndex < points.length; startIndex++) {
      const startTime = points[startIndex].time;
      const endTime = startTime + duration;
      if (endTime > points.at(-1)!.time) {
        break;
      }
      const end = cumulativeAt(endTime);
      const missing = end.invalidDuration - invalidDuration[startIndex];
      if (missing > 0.001) {
        continue;
      }
      const averagePower = (end.energy - energy[startIndex]) / duration;
      if (!best || averagePower > best.value) {
        best = {
          type,
          distance: duration,
          elapsedTime: duration,
          startTime,
          endTime,
          value: averagePower,
          valueKind: 'power',
        };
      }
    }
    return best ? [best] : [];
  });
};
