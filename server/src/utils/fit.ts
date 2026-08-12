import { FitLapMesg, FitMessages, FitRecordMesg } from 'src/repositories/fit.repository';
import { ParsedActivity, ParsedActivityStructure, ParsedLap, ParsedStream, StreamType } from 'src/types';
import { toActivityType } from 'src/utils/activity';
import {
  computeElevationChange,
  computeMovingTime,
  computeNormalizedPower,
  inferSampleInterval,
} from 'src/utils/activity-metrics';
import { haversineDistance } from 'src/utils/geo';
import { int, lastFinite, max, mean, num, roundOrNull } from 'src/utils/math';

const SEMICIRCLE_TO_DEGREES = 180 / 2 ** 31;

// FIT timestamps count seconds from 1989-12-31T00:00:00Z
const FIT_EPOCH_OFFSET_S = 631_065_600;

export class FitParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FitParseError';
  }
}

export const toDate = (value?: Date | number | null): Date | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    // Missing sample, return as NaN
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value > 1e12) {
    return new Date(value);
  }
  if (value > 1e9) {
    return new Date(value * 1000);
  }
  return new Date((value + FIT_EPOCH_OFFSET_S) * 1000);
};

export const toDegrees = (value?: number | null): number | null => {
  // Some .FIT converters pre-convert semicircles to degrees, but any value
  // outside the valid degree range must still be in semicircles
  const parsed = num(value);
  if (parsed === null) {
    return null;
  }
  return Math.abs(parsed) > 180 ? parsed * SEMICIRCLE_TO_DEGREES : parsed;
};

export const toName = (value?: string | number | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === 'string' ? value : String(value);
};

const EXTRACTORS: { type: StreamType; extract: (record: FitRecordMesg) => number | null }[] = [
  { type: 'latitude', extract: (record) => toDegrees(record.positionLat) },
  { type: 'longitude', extract: (record) => toDegrees(record.positionLong) },
  { type: 'altitude', extract: (record) => num(record.enhancedAltitude ?? record.altitude) },
  { type: 'distance', extract: (record) => num(record.distance) },
  { type: 'speed', extract: (record) => num(record.enhancedSpeed ?? record.speed) },
  { type: 'heartrate', extract: (record) => int(record.heartRate) },
  { type: 'cadence', extract: (record) => int(record.cadence) },
  { type: 'power', extract: (record) => int(record.power) },
  { type: 'temperature', extract: (record) => num(record.temperature) },
];

const hasAnySample = (data: number[]): boolean => data.some((value) => Number.isFinite(value));

const isValidPosition = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const deriveDistanceFromPosition = (
  latitude: number[],
  longitude: number[],
  sessionDistance: number | null,
): number[] | undefined => {
  let previous: { latitude: number; longitude: number } | undefined;
  let totalDistance = 0;
  const distance = latitude.map((currentLatitude, index) => {
    const currentLongitude = longitude[index];
    if (!isValidPosition(currentLatitude, currentLongitude)) {
      return NaN;
    }

    if (previous) {
      totalDistance += haversineDistance(previous.latitude, previous.longitude, currentLatitude, currentLongitude);
    }
    previous = { latitude: currentLatitude, longitude: currentLongitude };
    return totalDistance;
  });

  if (!Number.isFinite(totalDistance) || totalDistance <= 0) {
    return;
  }

  // Device summaries are usually more accurate than a distance reconstructed from rounded
  // coordinates. Reconcile small GPS drift while refusing to stretch a partial or corrupt track.
  const reconciliationRatio = sessionDistance === null ? 1 : sessionDistance / totalDistance;
  const scale = reconciliationRatio >= 0.8 && reconciliationRatio <= 1.25 ? reconciliationRatio : 1;
  return distance.map((value) => (Number.isFinite(value) ? value * scale : NaN));
};

export const buildStreams = (records: FitRecordMesg[], startedAt: Date): ParsedStream[] => {
  const streams: ParsedStream[] = [];

  const time = records.map((record) => {
    const timestamp = toDate(record.timestamp);
    return timestamp === null ? NaN : (timestamp.getTime() - startedAt.getTime()) / 1000;
  });
  if (hasAnySample(time)) {
    streams.push({ type: 'time', data: time });
  }

  for (const { type, extract } of EXTRACTORS) {
    const data = records.map((record) => extract(record) ?? NaN);
    if (hasAnySample(data)) {
      streams.push({ type, data });
    }
  }

  return streams;
};

export const mapLap = (lap: FitLapMesg, index: number): ParsedLap => ({
  index,
  startedAt: toDate(lap.startTime),
  elapsedTimeS: int(lap.totalElapsedTime),
  movingTimeS: int(lap.totalTimerTime),
  distanceM: num(lap.totalDistance),
  avgHr: int(lap.avgHeartRate),
  maxHr: int(lap.maxHeartRate),
  avgPower: int(lap.avgPower),
  avgSpeedMps: num(lap.enhancedAvgSpeed ?? lap.avgSpeed),
});

export const findStream = (activity: ParsedActivity, type: StreamType): number[] | undefined =>
  activity.streams.find((stream) => stream.type === type)?.data;

export const parseFitStructure = (messages: FitMessages): ParsedActivityStructure => {
  const session = messages.sessionMesgs?.[0];
  const records = messages.recordMesgs ?? [];

  const startedAt = toDate(session?.startTime) ?? toDate(records[0]?.timestamp);
  if (startedAt === null) {
    throw new FitParseError('FIT file contains no session start time and no timestamped records');
  }

  const streams = buildStreams(records, startedAt);
  const streamData = (type: StreamType): number[] => streams.find((stream) => stream.type === type)?.data ?? [];
  const sessionDistance = num(session?.totalDistance);
  const distance = streamData('distance');
  if (!hasAnySample(distance)) {
    const derivedDistance = deriveDistanceFromPosition(
      streamData('latitude'),
      streamData('longitude'),
      sessionDistance,
    );
    if (derivedDistance) {
      streams.push({ type: 'distance', data: derivedDistance });
    }
  }

  return {
    sport: toActivityType(toName(session?.sport), toName(session?.subSport)),
    name: null,
    startedAt,
    timezoneOffset: null,
    streams,
    laps: (messages.lapMesgs ?? []).map((lap, index) => mapLap(lap, index)),
  };
};

export const parseFitMessages = (messages: FitMessages): ParsedActivity => {
  const session = messages.sessionMesgs?.[0];
  const structure = parseFitStructure(messages);
  const streamData = (type: StreamType): number[] =>
    structure.streams.find((stream) => stream.type === type)?.data ?? [];

  const time = streamData('time');
  const altitude = streamData('altitude');
  const speed = streamData('speed');
  const power = streamData('power');
  const heartrate = streamData('heartrate');
  const cadence = streamData('cadence');
  const distance = streamData('distance');
  const sessionDistance = num(session?.totalDistance);

  const sampleIntervalS = inferSampleInterval(time);
  const elevation = computeElevationChange(altitude, { sampleIntervalS, smoothingWindowS: 90 });
  const finalTime = lastFinite(time);

  const elapsedTimeS = int(session?.totalElapsedTime) ?? (finalTime === undefined ? 0 : Math.round(finalTime));
  const movingTimeS = int(session?.totalTimerTime) ?? computeMovingTime(speed, time);
  const distanceM = sessionDistance ?? lastFinite(distance) ?? null;

  // Older devices record neither an average speed nor a speed stream, but distance and time
  // are nearly always present
  const derivedAvgSpeedMps =
    distanceM !== null && movingTimeS !== null && movingTimeS > 0 ? distanceM / movingTimeS : null;

  // If there is a session summary, use that. Otherwise derive this data from the streams.
  return {
    ...structure,
    elapsedTime: elapsedTimeS,
    movingTime: movingTimeS,
    distance: distanceM,
    elevationGain: num(session?.totalAscent) ?? (altitude.length > 0 ? elevation.gainM : null),
    elevationLoss: num(session?.totalDescent) ?? (altitude.length > 0 ? elevation.lossM : null),
    avgSpeed: num(session?.enhancedAvgSpeed ?? session?.avgSpeed) ?? mean(speed) ?? derivedAvgSpeedMps,
    maxSpeed: num(session?.enhancedMaxSpeed ?? session?.maxSpeed) ?? max(speed),
    avgHr: int(session?.avgHeartRate) ?? roundOrNull(mean(heartrate)),
    maxHr: int(session?.maxHeartRate) ?? roundOrNull(max(heartrate)),
    avgCadence: int(session?.avgCadence) ?? roundOrNull(mean(cadence)),
    maxCadence: int(session?.maxCadence) ?? roundOrNull(max(cadence)),
    avgPower: int(session?.avgPower) ?? roundOrNull(mean(power)),
    maxPower: int(session?.maxPower) ?? roundOrNull(max(power)),
    normalizedPower: int(session?.normalizedPower) ?? computeNormalizedPower(power, sampleIntervalS),
    calories: int(session?.totalCalories),
  };
};
