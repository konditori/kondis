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
  Sport,
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
  [Sport.AlpineSki]: presentation("Alpine skiing", Snowflake),
  [Sport.BackcountrySki]: presentation("Backcountry skiing", Snowflake),
  [Sport.Badminton]: presentation("Badminton", HeartPulse),
  [Sport.Basketball]: presentation("Basketball", HeartPulse),
  [Sport.Canoeing]: presentation("Canoeing", WavesHorizontal),
  [Sport.Cricket]: presentation("Cricket", HeartPulse),
  [Sport.CrossCountrySki]: presentation("Cross-country skiing", Snowflake),
  [Sport.Crossfit]: presentation("CrossFit", Dumbbell),
  [Sport.Dance]: presentation("Dance", HeartPulse),
  [Sport.EBikeRide]: presentation("E-bike ride", Bike),
  [Sport.Elliptical]: presentation("Elliptical", HeartPulse),
  [Sport.EMountainBikeRide]: presentation("E-mountain bike ride", Bike),
  [Sport.Golf]: presentation("Golf", HeartPulse, ActivityMapStyle.Heatmap),
  [Sport.GravelRide]: presentation("Gravel ride", Bike),
  [Sport.Handcycle]: presentation("Handcycle", Bike),
  [Sport.HighIntensityIntervalTraining]: presentation("HIIT", Dumbbell),
  [Sport.Hike]: presentation("Hike", Footprints),
  [Sport.IceSkate]: presentation("Ice skating", Snowflake),
  [Sport.InlineSkate]: presentation("Inline skating", SportShoe),
  [Sport.Kayaking]: presentation("Kayaking", WavesHorizontal),
  [Sport.Kitesurf]: presentation("Kitesurfing", WavesHorizontal),
  [Sport.MountainBikeRide]: presentation("Mountain bike ride", Bike),
  [Sport.Padel]: presentation("Padel", HeartPulse),
  [Sport.PhysicalTherapy]: presentation("Physical therapy", HeartPulse),
  [Sport.Pickleball]: presentation("Pickleball", HeartPulse),
  [Sport.Pilates]: presentation("Pilates", HeartPulse),
  [Sport.Racquetball]: presentation("Racquetball", HeartPulse),
  [Sport.Ride]: presentation("Ride", Bike),
  [Sport.RockClimbing]: presentation("Rock climbing", Mountain),
  [Sport.RollerSki]: presentation("Roller skiing", Mountain),
  [Sport.Rowing]: presentation("Rowing", WavesHorizontal),
  [Sport.Run]: presentation("Run", SportShoe),
  [Sport.Sail]: presentation(
    "Sailing",
    WavesHorizontal,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.Skateboard]: presentation(
    "Skateboarding",
    SportShoe,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.Snowboard]: presentation("Snowboarding", Snowflake),
  [Sport.Snowshoe]: presentation("Snowshoeing", Snowflake),
  [Sport.Soccer]: presentation(
    "Football (soccer)",
    HeartPulse,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.Squash]: presentation("Squash", HeartPulse),
  [Sport.StairStepper]: presentation("Stair stepper", HeartPulse),
  [Sport.StandUpPaddling]: presentation("Stand-up paddling", WavesHorizontal),
  [Sport.Surfing]: presentation(
    "Surfing",
    WavesHorizontal,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.Swim]: presentation("Swim", WavesHorizontal),
  [Sport.TableTennis]: presentation("Table tennis", HeartPulse),
  [Sport.Tennis]: presentation("Tennis", HeartPulse),
  [Sport.TrailRun]: presentation("Trail run", SportShoe),
  [Sport.Velomobile]: presentation("Velomobile", Bike),
  [Sport.VirtualRide]: presentation("Virtual ride", Bike),
  [Sport.VirtualRow]: presentation("Virtual row", WavesHorizontal),
  [Sport.VirtualRun]: presentation("Virtual run", SportShoe),
  [Sport.Volleyball]: presentation("Volleyball", HeartPulse),
  [Sport.Walk]: presentation("Walk", Footprints),
  [Sport.WeightTraining]: presentation("Weight training", Dumbbell),
  [Sport.Wheelchair]: presentation("Wheelchair", Footprints),
  [Sport.Windsurf]: presentation("Windsurfing", WavesHorizontal),
  [Sport.Workout]: presentation("Workout", HeartPulse),
  [Sport.Yoga]: presentation("Yoga", HeartPulse),
  [Sport.Other]: presentation("Other", HeartPulse),
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
