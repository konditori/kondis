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
} from "$lib/api";
import type { ActivityType } from "$lib/types";

export { AverageMetric };

export enum ActivityMapStyle {
  Route = "route",
  Heatmap = "heatmap",
}

type ActivityTypePresentation = {
  label: string;
  icon: Component;
  mapStyle: ActivityMapStyle;
};

const presentation = (
  label: string,
  icon: Component,
  mapStyle = ActivityMapStyle.Route,
): ActivityTypePresentation => ({ label, icon, mapStyle });

export const ACTIVITY_TYPE_PRESENTATION = {
  alpine_ski: presentation("Alpine skiing", Snowflake),
  backcountry_ski: presentation("Backcountry skiing", Snowflake),
  badminton: presentation("Badminton", HeartPulse),
  basketball: presentation("Basketball", HeartPulse),
  canoeing: presentation("Canoeing", WavesHorizontal),
  cricket: presentation("Cricket", HeartPulse),
  cross_country_ski: presentation("Cross-country skiing", Snowflake),
  crossfit: presentation("CrossFit", Dumbbell),
  dance: presentation("Dance", HeartPulse),
  e_bike_ride: presentation("E-bike ride", Bike),
  elliptical: presentation("Elliptical", HeartPulse),
  e_mountain_bike_ride: presentation("E-mountain bike ride", Bike),
  golf: presentation("Golf", HeartPulse, ActivityMapStyle.Heatmap),
  gravel_ride: presentation("Gravel ride", Bike),
  handcycle: presentation("Handcycle", Bike),
  high_intensity_interval_training: presentation("HIIT", Dumbbell),
  hike: presentation("Hike", Footprints),
  ice_skate: presentation("Ice skating", Snowflake),
  inline_skate: presentation("Inline skating", SportShoe),
  kayaking: presentation("Kayaking", WavesHorizontal),
  kitesurf: presentation("Kitesurfing", WavesHorizontal),
  mountain_bike_ride: presentation("Mountain bike ride", Bike),
  padel: presentation("Padel", HeartPulse),
  physical_therapy: presentation("Physical therapy", HeartPulse),
  pickleball: presentation("Pickleball", HeartPulse),
  pilates: presentation("Pilates", HeartPulse),
  racquetball: presentation("Racquetball", HeartPulse),
  ride: presentation("Ride", Bike),
  rock_climbing: presentation("Rock climbing", Mountain),
  roller_ski: presentation("Roller skiing", Mountain),
  rowing: presentation("Rowing", WavesHorizontal),
  run: presentation("Run", SportShoe),
  sail: presentation(
    "Sailing",
    WavesHorizontal,
    ActivityMapStyle.Heatmap,
  ),
  skateboard: presentation(
    "Skateboarding",
    SportShoe,
    ActivityMapStyle.Heatmap,
  ),
  snowboard: presentation("Snowboarding", Snowflake),
  snowshoe: presentation("Snowshoeing", Snowflake),
  soccer: presentation(
    "Football (soccer)",
    HeartPulse,
    ActivityMapStyle.Heatmap,
  ),
  squash: presentation("Squash", HeartPulse),
  stair_stepper: presentation("Stair stepper", HeartPulse),
  stand_up_paddling: presentation("Stand-up paddling", WavesHorizontal),
  surfing: presentation(
    "Surfing",
    WavesHorizontal,
    ActivityMapStyle.Heatmap,
  ),
  swim: presentation("Swim", WavesHorizontal),
  table_tennis: presentation("Table tennis", HeartPulse),
  tennis: presentation("Tennis", HeartPulse),
  trail_run: presentation("Trail run", SportShoe),
  velomobile: presentation("Velomobile", Bike),
  virtual_ride: presentation("Virtual ride", Bike),
  virtual_row: presentation("Virtual row", WavesHorizontal),
  virtual_run: presentation("Virtual run", SportShoe),
  volleyball: presentation("Volleyball", HeartPulse),
  walk: presentation("Walk", Footprints),
  weight_training: presentation("Weight training", Dumbbell),
  wheelchair: presentation("Wheelchair", Footprints),
  windsurf: presentation("Windsurfing", WavesHorizontal),
  workout: presentation("Workout", HeartPulse),
  yoga: presentation("Yoga", HeartPulse),
  other: presentation("Other", HeartPulse),
} satisfies Record<ActivityType, ActivityTypePresentation>;

export type ActivityTypeSettings = ActivityTypeSettingsOutput &
  ActivityTypePresentation;

export const activityTypeSettings = (
  types: ActivityTypeSettingsOutput[],
  type: ActivityType,
): ActivityTypeSettings => {
  const settings = types.find((candidate) => candidate.type === type);
  if (!settings) throw new Error(`Missing backend settings for ${type}`);
  return { ...settings, ...ACTIVITY_TYPE_PRESENTATION[type] };
};

export const activityTypeOptions = (
  types: ActivityTypeSettingsOutput[],
): { value: ActivityType; label: string }[] =>
  types.map(({ type }) => ({
    value: type,
    label: ACTIVITY_TYPE_PRESENTATION[type].label,
  }));

export const activityTypeLabel = (
  types: ActivityTypeSettingsOutput[],
  type: ActivityType,
): string => activityTypeSettings(types, type).label;

export const sportIcon = (type: ActivityType): Component =>
  ACTIVITY_TYPE_PRESENTATION[type].icon;
