import type { Sport } from "$lib/api";

export type ActivityType = Sport;

export type Activity = {
  id: string;
  uploadId: string;
  sport: ActivityType;
  name: string | null;
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
};

export type ActivityPage = {
  activities: Activity[];
  nextCursor: string | null;
  total: number;
};

export type ActivityDetail = Activity & {
  track: { type: "LineString"; coordinates: [number, number][] } | null;
  bestEfforts: {
    type: string;
    label: string;
    distance: number;
    elapsedTime: number;
    startTime: number;
    endTime: number;
  }[];
};
