import {
  computeElevationChange,
  computeMovingTimeS,
  computeNormalizedPower,
  inferSampleIntervalS,
  max,
  mean,
} from 'src/domain/activity/metrics';
import { ParsedActivity, ParsedLap, ParsedStream } from 'src/domain/activity/parsed-activity';
import { FitLapMesg, FitMessages, FitRecordMesg } from 'src/domain/fit/fit-messages';
import { StreamType } from 'src/types';

/**
 * Pure mapping from decoded FIT messages to `ParsedActivity`.
 *
 * Contains no decoder import on purpose, so it is unit-testable with plain objects and does
 * not require the Garmin SDK to be installed or a fixture file to exist.
 *
 * Missing samples inside a stream are represented as NaN rather than dropped, so every
 * stream stays index-aligned with every other stream. Postgres `double precision[]` stores
 * NaN natively, and the metric helpers skip non-finite values.
 */

const SEMICIRCLE_TO_DEGREES = 180 / 2 ** 31;

/** FIT timestamps count seconds from 1989-12-31T00:00:00Z. */
const FIT_EPOCH_OFFSET_S = 631_065_600;

export class FitParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FitParseError';
  }
}

const num = (value?: number | null): number | null =>
  value !== undefined && value !== null && Number.isFinite(value) ? value : null;

const int = (value?: number | null): number | null => {
  const parsed = num(value);
  return parsed === null ? null : Math.round(parsed);
};

const roundOrNull = (value: number | null): number | null => (value === null ? null : Math.round(value));

/**
 * Decoders differ in whether they hand back `Date` objects, Unix time, or raw FIT epoch
 * seconds, so all three are accepted and normalised here.
 */
const toDate = (value?: Date | number | null): Date | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
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

/**
 * FIT stores position in semicircles, but some decoders pre-convert to degrees. Any value
 * outside the valid degree range must therefore still be in semicircles.
 */
const toDegrees = (value?: number | null): number | null => {
  const parsed = num(value);
  if (parsed === null) {
    return null;
  }
  return Math.abs(parsed) > 180 ? parsed * SEMICIRCLE_TO_DEGREES : parsed;
};

const toName = (value?: string | number | null): string | null => {
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

const buildStreams = (records: FitRecordMesg[], startedAt: Date): ParsedStream[] => {
  const streams: ParsedStream[] = [];

  const time = records.map((record) => {
    const timestamp = toDate(record.timestamp);
    return timestamp === null ? Number.NaN : (timestamp.getTime() - startedAt.getTime()) / 1000;
  });
  if (hasAnySample(time)) {
    streams.push({ type: 'time', data: time });
  }

  for (const { type, extract } of EXTRACTORS) {
    const data = records.map((record) => extract(record) ?? Number.NaN);
    if (hasAnySample(data)) {
      streams.push({ type, data });
    }
  }

  return streams;
};

const lastFinite = (values: number[]): number | undefined => {
  for (let index = values.length - 1; index >= 0; index--) {
    if (Number.isFinite(values[index])) {
      return values[index];
    }
  }
  return;
};

const mapLap = (lap: FitLapMesg, index: number): ParsedLap => ({
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

export const parseFitMessages = (messages: FitMessages): ParsedActivity => {
  const session = messages.sessionMesgs?.[0];
  const records = messages.recordMesgs ?? [];

  const startedAt = toDate(session?.startTime) ?? toDate(records[0]?.timestamp);
  if (startedAt === null) {
    throw new FitParseError('FIT file contains no session start time and no timestamped records');
  }

  const streams = buildStreams(records, startedAt);
  const streamData = (type: StreamType): number[] => streams.find((stream) => stream.type === type)?.data ?? [];

  const time = streamData('time');
  const altitude = streamData('altitude');
  const speed = streamData('speed');
  const power = streamData('power');
  const heartrate = streamData('heartrate');
  const cadence = streamData('cadence');
  const distance = streamData('distance');

  const sampleIntervalS = inferSampleIntervalS(time);
  const elevation = computeElevationChange(altitude);
  const finalTime = lastFinite(time);

  // Session summaries are authoritative when present: the device computed them with more
  // context than we have. Stream-derived values are the fallback.
  return {
    sport: toName(session?.sport) ?? 'unknown',
    subSport: toName(session?.subSport),
    name: null,
    startedAt,
    timezoneOffsetMinutes: null,
    elapsedTimeS: int(session?.totalElapsedTime) ?? (finalTime === undefined ? 0 : Math.round(finalTime)),
    movingTimeS: int(session?.totalTimerTime) ?? computeMovingTimeS(speed, time),
    distanceM: num(session?.totalDistance) ?? lastFinite(distance) ?? null,
    elevationGainM: num(session?.totalAscent) ?? (altitude.length > 0 ? elevation.gainM : null),
    elevationLossM: num(session?.totalDescent) ?? (altitude.length > 0 ? elevation.lossM : null),
    avgSpeedMps: num(session?.enhancedAvgSpeed ?? session?.avgSpeed) ?? mean(speed),
    maxSpeedMps: num(session?.enhancedMaxSpeed ?? session?.maxSpeed) ?? max(speed),
    avgHr: int(session?.avgHeartRate) ?? roundOrNull(mean(heartrate)),
    maxHr: int(session?.maxHeartRate) ?? roundOrNull(max(heartrate)),
    avgCadence: int(session?.avgCadence) ?? roundOrNull(mean(cadence)),
    maxCadence: int(session?.maxCadence) ?? roundOrNull(max(cadence)),
    avgPower: int(session?.avgPower) ?? roundOrNull(mean(power)),
    maxPower: int(session?.maxPower) ?? roundOrNull(max(power)),
    normalizedPower: int(session?.normalizedPower) ?? computeNormalizedPower(power, sampleIntervalS),
    calories: int(session?.totalCalories),
    streams,
    laps: (messages.lapMesgs ?? []).map(mapLap),
  };
};
