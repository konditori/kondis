import FitParser from 'fit-file-parser';


import { ParsedLap, ParsedStream } from 'src/dtos/activity.dto';
import { FitLapMesg, FitMessages, FitRecordMesg, StreamType } from 'src/types';
import { int, num } from 'src/utils/math';

export class FitDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FitDecodeError';
  }
}

const NOT_A_FIT_FILE = [
  'File too small to be a FIT file',
  'File to small to be a FIT file',
  'Incorrect header size',
  "Missing '.FIT' in header",
];

type ParsedFit = Awaited<ReturnType<FitParser['parseAsync']>>;

const SEMICIRCLE_TO_DEGREES = 180 / 2 ** 31;

// FIT timestamps count seconds from 1989-12-31T00:00:00Z
const FIT_EPOCH_OFFSET_S = 631_065_600;

export class FitParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FitParseError';
  }
}

const parser = new FitParser({
  force: true, // Keep partially corrupt files, for example when a device battery dies while recording
  speedUnit: 'm/s',
  lengthUnit: 'm',
  temperatureUnit: 'celsius',
  mode: 'list',
});

const camelCaseKeys = new Map<string, string>();

const camelCaseKey = (key: string): string =>
  key.replaceAll(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());

const toCamelCase = (key: string): string => {
  let cached = camelCaseKeys.get(key);
  if (cached === undefined) {
    cached = camelCaseKey(key);
    camelCaseKeys.set(key, cached);
  }
  return cached;
};

const camelCaseMessages = <T>(messages: object[] | undefined): T[] =>
  (messages ?? []).map((message) => {
    const renamed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(message)) {
      renamed[toCamelCase(key)] = value;
    }
    return renamed as T;
  });

export const decodeFit = (contents: Buffer): FitMessages => {
  let decoded: ParsedFit | undefined;
  let failure: string | undefined;

  try {
    parser.parse(contents as Buffer<ArrayBuffer>, (error, data) => {
      failure = error;
      decoded = data;
    });
  } catch (error) {
    throw new FitDecodeError('FIT decoding failed', { cause: error });
  }

  if (failure !== undefined) {
    const isNotAFitFile = NOT_A_FIT_FILE.some((message) => failure.includes(message));
    throw new FitDecodeError(
      isNotAFitFile ? `File is not a valid FIT file: ${failure}` : `FIT decoding failed: ${failure}`,
    );
  }

  if (decoded === undefined) {
    throw new FitDecodeError('FIT decoding produced no messages');
  }

  return {
    sessionMesgs: camelCaseMessages(decoded.sessions),
    recordMesgs: camelCaseMessages(decoded.records),
    lapMesgs: camelCaseMessages(decoded.laps),
  };
};



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
