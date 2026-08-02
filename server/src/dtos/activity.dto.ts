import { StreamType } from 'src/types';

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
