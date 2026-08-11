import {
  Bike,
  Dumbbell,
  Footprints,
  HeartPulse,
  Mountain,
  Snowflake,
  SportShoe,
  WavesHorizontal,
} from "@lucide/svelte";
import { Sport } from "$lib/api";
import type { ActivityType } from "$lib/types";

export enum AverageMetric {
  None = "none",
  Pace = "pace",
  SwimPace = "swimPace",
  Speed = "speed",
}

type ActivityTypeSettings = {
  label: string;
  icon: typeof Bike;
  averageMetric: AverageMetric;
  showAveragePower: boolean;
};

export const ACTIVITY_TYPE_SETTINGS = {
  [Sport.Run]: {
    label: "Run",
    icon: SportShoe,
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  },
  [Sport.Ride]: {
    label: "Ride",
    icon: Bike,
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
  },
  [Sport.TrailRun]: {
    label: "Trail run",
    icon: SportShoe,
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  },
  [Sport.Walk]: {
    label: "Walk",
    icon: Footprints,
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  },
  [Sport.Hike]: {
    label: "Hike",
    icon: Footprints,
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  },
  [Sport.Swim]: {
    label: "Swim",
    icon: WavesHorizontal,
    averageMetric: AverageMetric.SwimPace,
    showAveragePower: false,
  },
  [Sport.AlpineSki]: {
    label: "Alpine skiing",
    icon: Snowflake,
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  },
  [Sport.RollerSki]: {
    label: "Roller skiing",
    icon: Mountain,
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  },
  [Sport.CrossCountrySki]: {
    label: "Cross-country skiing",
    icon: Snowflake,
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  },
  [Sport.IceSkate]: {
    label: "Ice skating",
    icon: Snowflake,
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  },
  [Sport.Other]: {
    label: "Other",
    icon: HeartPulse,
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  },
} satisfies Record<ActivityType, ActivityTypeSettings>;

export const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] =
  Object.entries(ACTIVITY_TYPE_SETTINGS).map(([value, { label }]) => ({
    value: value as ActivityType,
    label,
  }));

export const activityTypeSettings = (
  type: ActivityType,
): ActivityTypeSettings => ACTIVITY_TYPE_SETTINGS[type];

export const activityTypeLabel = (type: ActivityType): string =>
  activityTypeSettings(type).label;

export const sportIcon = (type: ActivityType): typeof Bike =>
  activityTypeSettings(type).icon;
