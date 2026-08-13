export type DetailStream = {
  type: string;
  data: number[];
};

export type ActivitySplit = {
  distance: number;
  elapsedTime: number;
  startTime: number;
  endTime: number;
  avgHr: number | null;
  elevationChange: number | null;
};

export type ActivityProfilePoint = {
  distance: number;
  time: number;
  altitude: number;
};

export type ActivityRoutePoint = {
  time: number;
  coordinate: [number, number];
};

export type ActivityAnalysis = {
  splits: ActivitySplit[];
  profile: ActivityProfilePoint[];
  route: ActivityRoutePoint[];
};

const PROFILE_SAMPLE_LIMIT = 1_200;
const ROUTE_SAMPLE_LIMIT = 2_400;
const KILOMETER = 1_000;

const stream = (streams: DetailStream[], type: string): number[] =>
  streams.find((candidate) => candidate.type === type)?.data ?? [];

const downsample = <T>(points: T[], limit: number): T[] => {
  if (points.length <= limit) return points;

  const sampled: T[] = [];
  const step = (points.length - 1) / (limit - 1);
  for (let sample = 0; sample < limit; sample++) {
    sampled.push(points[Math.round(sample * step)]!);
  }
  return sampled;
};

const interpolateAtDistance = (time: number[], distance: number[], targetDistance: number): number | null => {
  for (let index = 1; index < Math.min(time.length, distance.length); index++) {
    const beforeDistance = distance[index - 1];
    const afterDistance = distance[index];
    const beforeTime = time[index - 1];
    const afterTime = time[index];
    if (
      !Number.isFinite(beforeDistance) ||
      !Number.isFinite(afterDistance) ||
      !Number.isFinite(beforeTime) ||
      !Number.isFinite(afterTime) ||
      afterDistance < beforeDistance ||
      targetDistance < beforeDistance ||
      targetDistance > afterDistance
    ) {
      continue;
    }
    if (afterDistance === beforeDistance) return afterTime;
    const ratio = (targetDistance - beforeDistance) / (afterDistance - beforeDistance);
    return beforeTime + ratio * (afterTime - beforeTime);
  }
  return null;
};

const interpolateAtTime = (time: number[], values: number[], targetTime: number): number | null => {
  for (let index = 1; index < Math.min(time.length, values.length); index++) {
    const beforeTime = time[index - 1];
    const afterTime = time[index];
    const beforeValue = values[index - 1];
    const afterValue = values[index];
    if (
      !Number.isFinite(beforeTime) ||
      !Number.isFinite(afterTime) ||
      !Number.isFinite(beforeValue) ||
      !Number.isFinite(afterValue) ||
      targetTime < beforeTime ||
      targetTime > afterTime
    ) {
      continue;
    }
    if (afterTime === beforeTime) return afterValue;
    const ratio = (targetTime - beforeTime) / (afterTime - beforeTime);
    return beforeValue + ratio * (afterValue - beforeValue);
  }
  return null;
};

const averageInTimeRange = (time: number[], values: number[], startTime: number, endTime: number): number | null => {
  const included: number[] = [];
  for (let index = 0; index < Math.min(time.length, values.length); index++) {
    if (time[index] >= startTime && time[index] <= endTime && Number.isFinite(values[index])) {
      included.push(values[index]);
    }
  }
  if (included.length === 0) return null;
  return Math.round(included.reduce((total, value) => total + value, 0) / included.length);
};

const buildSplits = (time: number[], distance: number[], heartrate: number[], altitude: number[]): ActivitySplit[] => {
  const finalDistance = [...distance].reverse().find(Number.isFinite);
  if (finalDistance === undefined || !Number.isFinite(finalDistance) || finalDistance <= 0) return [];

  const splits: ActivitySplit[] = [];
  for (let startDistance = 0; startDistance < finalDistance; startDistance += KILOMETER) {
    const endDistance = Math.min(startDistance + KILOMETER, finalDistance);
    const startTime = interpolateAtDistance(time, distance, startDistance);
    const endTime = interpolateAtDistance(time, distance, endDistance);
    if (startTime === null || endTime === null || endTime <= startTime) continue;

    const startAltitude = interpolateAtTime(time, altitude, startTime);
    const endAltitude = interpolateAtTime(time, altitude, endTime);
    splits.push({
      distance: endDistance - startDistance,
      elapsedTime: endTime - startTime,
      startTime,
      endTime,
      avgHr: averageInTimeRange(time, heartrate, startTime, endTime),
      elevationChange: startAltitude === null || endAltitude === null ? null : endAltitude - startAltitude,
    });
  }
  return splits;
};

export const buildActivityAnalysis = (streams: DetailStream[]): ActivityAnalysis | null => {
  const time = stream(streams, 'time');
  const distance = stream(streams, 'distance');
  if (time.length === 0 || distance.length === 0) return null;

  const altitude = stream(streams, 'altitude');
  const heartrate = stream(streams, 'heartrate');
  const latitude = stream(streams, 'latitude');
  const longitude = stream(streams, 'longitude');
  const profile: ActivityProfilePoint[] = [];
  const route: ActivityRoutePoint[] = [];
  const length = Math.min(time.length, distance.length);

  for (let index = 0; index < length; index++) {
    if (!Number.isFinite(time[index]) || !Number.isFinite(distance[index])) continue;
    if (Number.isFinite(altitude[index])) {
      profile.push({ time: time[index], distance: distance[index], altitude: altitude[index] });
    }
    if (
      Number.isFinite(latitude[index]) &&
      Number.isFinite(longitude[index]) &&
      latitude[index] >= -90 &&
      latitude[index] <= 90 &&
      longitude[index] >= -180 &&
      longitude[index] <= 180
    ) {
      route.push({ time: time[index], coordinate: [longitude[index], latitude[index]] });
    }
  }

  return {
    splits: buildSplits(time, distance, heartrate, altitude),
    profile: downsample(profile, PROFILE_SAMPLE_LIMIT),
    route: downsample(route, ROUTE_SAMPLE_LIMIT),
  };
};
