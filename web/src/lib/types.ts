import type { Sport } from "$lib/api";

export type ActivityType = Sport;

export type Activity = {
  id: string;
  uploadId: string;
  sport: ActivityType;
  name: string | null;
  description: string | null;
  startedAt: string;
  timezoneOffsetMinutes: number | null;
  elapsedTime: number;
  movingTime: number | null;
  distance: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  avgSpeed: number | null;
  maxSpeed: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  avgPower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  calories: number | null;
  createdAt: string;
  updatedAt: string;
  track: { type: "LineString"; coordinates: [number, number][] } | null;
  topBestEfforts?: {
    type: string;
    overallRank: number;
    yearRank: number;
  }[];
};

export type ActivityPage = {
  activities: Activity[];
  nextCursor: string | null;
  total: number;
};

export type ActivityDetail = Activity & {
  bestEfforts: {
    type: string;
    distance: number;
    elapsedTime: number;
    startTime: number;
    endTime: number;
    avgHr: number | null;
    elevationChange: number | null;
    overallRank: number;
    year: number;
    yearRank: number;
  }[];
};

export type BestEffortSport = "run" | "ride";
export type BestEffortValueKind =
  "duration" | "distance" | "elevation" | "power";

export type BestEffortHistory = {
  sport: BestEffortSport;
  type: string;
  valueKind: BestEffortValueKind;
  higherIsBetter: boolean;
  distance: number | null;
  duration: number | null;
  options: { type: string; valueKind: BestEffortValueKind }[];
  efforts: {
    activityId: string;
    activityName: string | null;
    sport: ActivityType;
    startedAt: string;
    elapsedTime: number;
    value: number;
    overallRank: number;
    year: number;
    yearRank: number;
  }[];
};
