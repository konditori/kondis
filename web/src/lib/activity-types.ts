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

export type AverageMetric = "pace" | "swimPace" | "speed" | null;

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
    averageMetric: "pace",
    showAveragePower: false,
  },
  [Sport.Ride]: {
    label: "Ride",
    icon: Bike,
    averageMetric: "speed",
    showAveragePower: true,
  },
  [Sport.TrailRun]: {
    label: "Trail run",
    icon: SportShoe,
    averageMetric: "pace",
    showAveragePower: false,
  },
  [Sport.Walk]: {
    label: "Walk",
    icon: Footprints,
    averageMetric: "pace",
    showAveragePower: false,
  },
  [Sport.Hike]: {
    label: "Hike",
    icon: Footprints,
    averageMetric: "pace",
    showAveragePower: false,
  },
  [Sport.Swim]: {
    label: "Swim",
    icon: WavesHorizontal,
    averageMetric: "swimPace",
    showAveragePower: false,
  },
  [Sport.AlpineSki]: {
    label: "Alpine skiing",
    icon: Snowflake,
    averageMetric: "speed",
    showAveragePower: false,
  },
  [Sport.RollerSki]: {
    label: "Roller skiing",
    icon: Mountain,
    averageMetric: "pace",
    showAveragePower: false,
  },
  [Sport.CrossCountrySki]: {
    label: "Cross-country skiing",
    icon: Snowflake,
    averageMetric: "speed",
    showAveragePower: false,
  },
  [Sport.IceSkate]: {
    label: "Ice skating",
    icon: Snowflake,
    averageMetric: null,
    showAveragePower: false,
  },
  [Sport.Other]: {
    label: "Other",
    icon: HeartPulse,
    averageMetric: "speed",
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
