import { ConsoleLogger, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

import type { FitLapMesg, FitMessages, FitRecordMesg, FitSessionMesg } from 'src/types';

export class TcxDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TcxDecodeError';
  }
}

type MaybeArray<T> = T | T[] | undefined;

type TcxTrackpoint = {
  Time?: string;
  Position?: {
    LatitudeDegrees?: number | string;
    LongitudeDegrees?: number | string;
  };
  AltitudeMeters?: number | string;
  DistanceMeters?: number | string;
  HeartRateBpm?: {
    Value?: number | string;
  };
  Cadence?: number | string;
  Extensions?: Record<string, unknown>;
};

type TcxTrack = {
  Trackpoint?: MaybeArray<TcxTrackpoint>;
};

type TcxLap = {
  StartTime?: string;
  TotalTimeSeconds?: number | string;
  DistanceMeters?: number | string;
  Calories?: number | string;
  AverageHeartRateBpm?: { Value?: number | string };
  MaximumHeartRateBpm?: { Value?: number | string };
  Cadence?: number | string;
  Track?: MaybeArray<TcxTrack>;
};

type TcxActivity = {
  Sport?: string;
  Id?: string;
  Lap?: MaybeArray<TcxLap>;
};

@Injectable()
export class TcxRepository {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
  });

  constructor(private readonly logger: ConsoleLogger) {
    this.logger.setContext(TcxRepository.name);
  }

  decode(contents: Buffer): FitMessages {
    const xml = contents.toString('utf8').trim();
    if (xml.length === 0) {
      throw new TcxDecodeError('File is not a valid TCX file: empty file');
    }

    let raw: unknown;
    try {
      raw = this.xmlParser.parse(xml);
    } catch (error) {
      throw new TcxDecodeError('File is not a valid TCX file: malformed XML', { cause: error });
    }

    const activity = this.getActivity(raw);
    const laps = asArray(activity.Lap);

    const recordMesgs: FitRecordMesg[] = [];
    const lapMesgs: FitLapMesg[] = [];

    for (const lap of laps) {
      const trackpoints = this.getTrackpoints(lap);

      for (const point of trackpoints) {
        recordMesgs.push({
          timestamp: toDate(point.Time),
          positionLat: toNumber(point.Position?.LatitudeDegrees),
          positionLong: toNumber(point.Position?.LongitudeDegrees),
          altitude: toNumber(point.AltitudeMeters),
          distance: toNumber(point.DistanceMeters),
          heartRate: toInteger(point.HeartRateBpm?.Value),
          cadence: toInteger(point.Cadence),
          speed: this.extractTpxNumber(point.Extensions, 'Speed'),
          power: this.extractTpxInteger(point.Extensions, 'Watts'),
        });
      }

      lapMesgs.push({
        startTime: toDate(lap.StartTime) ?? toDate(trackpoints[0]?.Time),
        totalElapsedTime: toNumber(lap.TotalTimeSeconds),
        totalTimerTime: toNumber(lap.TotalTimeSeconds),
        totalDistance: toNumber(lap.DistanceMeters),
        avgHeartRate: toInteger(lap.AverageHeartRateBpm?.Value),
        maxHeartRate: toInteger(lap.MaximumHeartRateBpm?.Value),
      });
    }

    // Some Strava takeouts contain a stale or otherwise incorrect Activity Id,
    // while the lap and trackpoint timestamps still describe the actual activity.
    const startedAt = toDate(laps[0]?.StartTime) ?? toDate(recordMesgs[0]?.timestamp) ?? toDate(activity.Id);
    const totalElapsedTime = sumNumbers(laps.map((lap) => toNumber(lap.TotalTimeSeconds)));
    const totalDistance = sumNumbers(laps.map((lap) => toNumber(lap.DistanceMeters)));
    const totalCalories = sumIntegers(laps.map((lap) => toInteger(lap.Calories)));

    const sessionMesg: FitSessionMesg = {
      sport: normalizeSport(activity.Sport),
      startTime: startedAt,
      totalElapsedTime,
      totalTimerTime: totalElapsedTime,
      totalDistance,
      totalCalories,
      maxHeartRate: maxInteger(laps.map((lap) => toInteger(lap.MaximumHeartRateBpm?.Value))),
    };

    if (totalDistance !== undefined && totalElapsedTime !== undefined && totalElapsedTime > 0) {
      sessionMesg.avgSpeed = totalDistance / totalElapsedTime;
    }

    return {
      sessionMesgs: [sessionMesg],
      recordMesgs,
      lapMesgs,
    };
  }

  private getActivity(raw: unknown): TcxActivity {
    const root = asRecord(raw);
    const db = asRecord(root?.TrainingCenterDatabase);
    const activities = asRecord(db?.Activities);
    const activity = asArray(activities?.Activity)[0];

    if (!activity) {
      throw new TcxDecodeError('File is not a valid TCX file: missing Activities.Activity');
    }

    return activity;
  }

  private getTrackpoints(lap: TcxLap): TcxTrackpoint[] {
    const tracks = asArray(lap.Track);
    const all: TcxTrackpoint[] = [];

    for (const track of tracks) {
      all.push(...asArray(track.Trackpoint));
    }

    return all;
  }

  private extractTpxInteger(extensions: Record<string, unknown> | undefined, key: string): number | undefined {
    return toInteger(this.extractTpxValue(extensions, key));
  }

  private extractTpxNumber(extensions: Record<string, unknown> | undefined, key: string): number | undefined {
    return toNumber(this.extractTpxValue(extensions, key));
  }

  private extractTpxValue(extensions: Record<string, unknown> | undefined, key: string): unknown {
    const node = asRecord(extensions);
    const tpx = asRecord(node?.TPX) ?? asRecord(node?.TrackpointExtension) ?? firstObject(node);
    return tpx?.[key];
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

const asArray = <T>(value: MaybeArray<T>): T[] => {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const firstObject = (value: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!value) {
    return undefined;
  }

  for (const candidate of Object.values(value)) {
    const parsed = asRecord(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toInteger = (value: unknown): number | undefined => {
  const parsed = toNumber(value);
  return parsed === undefined ? undefined : Math.round(parsed);
};

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const sumNumbers = (values: Array<number | undefined>): number | undefined => {
  const valid = values.filter((value): value is number => value !== undefined);
  if (valid.length === 0) {
    return undefined;
  }
  return valid.reduce((sum, value) => sum + value, 0);
};

const sumIntegers = (values: Array<number | undefined>): number | undefined => {
  const total = sumNumbers(values);
  return total === undefined ? undefined : Math.round(total);
};

const maxInteger = (values: Array<number | undefined>): number | undefined => {
  const valid = values.filter((value): value is number => value !== undefined);
  if (valid.length === 0) {
    return undefined;
  }
  return Math.max(...valid);
};

const normalizeSport = (value: unknown): string => {
  if (typeof value !== 'string') {
    return 'unknown';
  }
  return value.trim().toLowerCase() || 'unknown';
};
