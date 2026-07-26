import { StreamType } from 'src/types';

/**
 * Canonical parsed-activity shape.
 *
 * Every input format targets this type. `.fit` today, `.gpx` next (README goal 3), and
 * anything after that. Persistence, metrics and jobs depend only on `ParsedActivity` and
 * never learn which format the data arrived in, so a second format is a new parser rather
 * than a second pipeline.
 *
 * All units are SI: metres, seconds, metres per second.
 */

export type ParsedStream = {
  type: StreamType;
  data: number[];
};

export type ParsedLap = {
  index: number;
  startedAt: Date | null;
  elapsedTimeS: number | null;
  movingTimeS: number | null;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPower: number | null;
  avgSpeedMps: number | null;
};

export type ParsedActivity = {
  sport: string;
  subSport: string | null;
  name: string | null;
  startedAt: Date;
  timezoneOffsetMinutes: number | null;
  elapsedTimeS: number;
  movingTimeS: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  avgPower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  calories: number | null;
  streams: ParsedStream[];
  laps: ParsedLap[];
};

export const findStream = (activity: ParsedActivity, type: StreamType): number[] | undefined =>
  activity.streams.find((stream) => stream.type === type)?.data;
