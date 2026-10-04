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
import type { Component } from "svelte";
import {
  AverageMetric,
  type ActivityTypeSettingsOutput,
  type ActivityType_Output,
} from "$lib/api";
import { t } from "$lib/i18n";
import type { ActivityType } from "$lib/types";

export { AverageMetric };

export enum ActivityMapStyle {
  Route = "route",
  Heatmap = "heatmap",
}

type ActivityTypePresentation = {
  icon: Component;
  mapStyle: ActivityMapStyle;
};

const presentation = (
  icon: Component,
  mapStyle = ActivityMapStyle.Route,
): ActivityTypePresentation => ({ icon, mapStyle });

export const ACTIVITY_TYPE_PRESENTATION = {
  alpine_ski: presentation(Snowflake),
  backcountry_ski: presentation(Snowflake),
  badminton: presentation(HeartPulse),
  basketball: presentation(HeartPulse),
  canoeing: presentation(WavesHorizontal),
  cricket: presentation(HeartPulse),
  cross_country_ski: presentation(Snowflake),
  crossfit: presentation(Dumbbell),
  dance: presentation(HeartPulse),
  e_bike_ride: presentation(Bike),
  elliptical: presentation(HeartPulse),
  e_mountain_bike_ride: presentation(Bike),
  golf: presentation(HeartPulse, ActivityMapStyle.Heatmap),
  gravel_ride: presentation(Bike),
  handcycle: presentation(Bike),
  high_intensity_interval_training: presentation(Dumbbell),
  hike: presentation(Footprints),
  ice_skate: presentation(Snowflake),
  inline_skate: presentation(SportShoe),
  kayaking: presentation(WavesHorizontal),
  kitesurf: presentation(WavesHorizontal),
  mountain_bike_ride: presentation(Bike),
  padel: presentation(HeartPulse),
  physical_therapy: presentation(HeartPulse),
  pickleball: presentation(HeartPulse),
  pilates: presentation(HeartPulse),
  racquetball: presentation(HeartPulse),
  ride: presentation(Bike),
  rock_climbing: presentation(Mountain),
  roller_ski: presentation(Mountain),
  rowing: presentation(WavesHorizontal),
  run: presentation(SportShoe),
  sail: presentation(WavesHorizontal, ActivityMapStyle.Heatmap),
  skateboard: presentation(SportShoe, ActivityMapStyle.Heatmap),
  snowboard: presentation(Snowflake),
  snowshoe: presentation(Snowflake),
  soccer: presentation(HeartPulse, ActivityMapStyle.Heatmap),
  squash: presentation(HeartPulse),
  stair_stepper: presentation(HeartPulse),
  stand_up_paddling: presentation(WavesHorizontal),
  surfing: presentation(WavesHorizontal, ActivityMapStyle.Heatmap),
  swim: presentation(WavesHorizontal),
  table_tennis: presentation(HeartPulse),
  tennis: presentation(HeartPulse),
  trail_run: presentation(SportShoe),
  velomobile: presentation(Bike),
  virtual_ride: presentation(Bike),
  virtual_row: presentation(WavesHorizontal),
  virtual_run: presentation(SportShoe),
  volleyball: presentation(HeartPulse),
  walk: presentation(Footprints),
  weight_training: presentation(Dumbbell),
  wheelchair: presentation(Footprints),
  windsurf: presentation(WavesHorizontal),
  workout: presentation(HeartPulse),
  yoga: presentation(HeartPulse),
  other: presentation(HeartPulse),
} satisfies Record<ActivityType, ActivityTypePresentation>;

export type ActivityTypeSettings = ActivityTypeSettingsOutput &
  ActivityTypePresentation & { label: string };

export const activityTypeSettings = (
  types: ActivityTypeSettingsOutput[],
  type: ActivityType_Output,
): ActivityTypeSettings => {
  const settings = types.find((candidate) => candidate.type === type);
  if (!settings) throw new Error(`Missing backend settings for ${type}`);
  return { ...settings, ...ACTIVITY_TYPE_PRESENTATION[type], label: t(type) };
};

export const activityTypeOptions = (
  types: ActivityTypeSettingsOutput[],
): { value: ActivityType_Output; label: string }[] =>
  types.map(({ type }) => ({
    value: type,
    label: t(type),
  }));

export const activityTypeLabel = (
  types: ActivityTypeSettingsOutput[],
  type: ActivityType,
): string => activityTypeSettings(types, type).label;

export const sportIcon = (type: ActivityType): Component =>
  ACTIVITY_TYPE_PRESENTATION[type].icon;
