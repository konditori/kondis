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

export enum ActivityMapStyle {
  Route = "route",
  Heatmap = "heatmap",
}

type ActivityTypeSettings = {
  label: string;
  icon: typeof Bike;
  averageMetric: AverageMetric;
  showAveragePower: boolean;
  mapStyle: ActivityMapStyle;
};

const settings = (
  label: string,
  icon: typeof Bike,
  averageMetric = AverageMetric.None,
  showAveragePower = false,
  mapStyle = ActivityMapStyle.Route,
): ActivityTypeSettings => ({
  label,
  icon,
  averageMetric,
  showAveragePower,
  mapStyle,
});

export const ACTIVITY_TYPE_SETTINGS = {
  [Sport.AlpineSki]: settings("Alpine skiing", Snowflake, AverageMetric.Speed),
  [Sport.BackcountrySki]: settings(
    "Backcountry skiing",
    Snowflake,
    AverageMetric.Speed,
  ),
  [Sport.Badminton]: settings("Badminton", HeartPulse),
  [Sport.Basketball]: settings("Basketball", HeartPulse),
  [Sport.Canoeing]: settings("Canoeing", WavesHorizontal, AverageMetric.Speed),
  [Sport.Cricket]: settings("Cricket", HeartPulse),
  [Sport.CrossCountrySki]: settings(
    "Cross-country skiing",
    Snowflake,
    AverageMetric.Speed,
  ),
  [Sport.Crossfit]: settings("CrossFit", Dumbbell),
  [Sport.Dance]: settings("Dance", HeartPulse),
  [Sport.EBikeRide]: settings("E-bike ride", Bike, AverageMetric.Speed),
  [Sport.Elliptical]: settings("Elliptical", HeartPulse),
  [Sport.EMountainBikeRide]: settings(
    "E-mountain bike ride",
    Bike,
    AverageMetric.Speed,
  ),
  [Sport.Golf]: settings(
    "Golf",
    HeartPulse,
    AverageMetric.None,
    false,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.GravelRide]: settings("Gravel ride", Bike, AverageMetric.Speed, true),
  [Sport.Handcycle]: settings("Handcycle", Bike, AverageMetric.Speed, true),
  [Sport.HighIntensityIntervalTraining]: settings("HIIT", Dumbbell),
  [Sport.Hike]: settings("Hike", Footprints, AverageMetric.Pace),
  [Sport.IceSkate]: settings("Ice skating", Snowflake),
  [Sport.InlineSkate]: settings(
    "Inline skating",
    SportShoe,
    AverageMetric.Speed,
  ),
  [Sport.Kayaking]: settings("Kayaking", WavesHorizontal, AverageMetric.Speed),
  [Sport.Kitesurf]: settings(
    "Kitesurfing",
    WavesHorizontal,
    AverageMetric.Speed,
  ),
  [Sport.MountainBikeRide]: settings(
    "Mountain bike ride",
    Bike,
    AverageMetric.Speed,
    true,
  ),
  [Sport.Padel]: settings("Padel", HeartPulse),
  [Sport.PhysicalTherapy]: settings("Physical therapy", HeartPulse),
  [Sport.Pickleball]: settings("Pickleball", HeartPulse),
  [Sport.Pilates]: settings("Pilates", HeartPulse),
  [Sport.Racquetball]: settings("Racquetball", HeartPulse),
  [Sport.Ride]: settings("Ride", Bike, AverageMetric.Speed, true),
  [Sport.RockClimbing]: settings("Rock climbing", Mountain),
  [Sport.RollerSki]: settings("Roller skiing", Mountain, AverageMetric.Pace),
  [Sport.Rowing]: settings("Rowing", WavesHorizontal, AverageMetric.Speed),
  [Sport.Run]: settings("Run", SportShoe, AverageMetric.Pace),
  [Sport.Sail]: settings(
    "Sailing",
    WavesHorizontal,
    AverageMetric.Speed,
    false,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.Skateboard]: settings(
    "Skateboarding",
    SportShoe,
    AverageMetric.Speed,
    false,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.Snowboard]: settings("Snowboarding", Snowflake, AverageMetric.Speed),
  [Sport.Snowshoe]: settings("Snowshoeing", Snowflake, AverageMetric.Pace),
  [Sport.Soccer]: settings(
    "Football (soccer)",
    HeartPulse,
    AverageMetric.None,
    false,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.Squash]: settings("Squash", HeartPulse),
  [Sport.StairStepper]: settings("Stair stepper", HeartPulse),
  [Sport.StandUpPaddling]: settings(
    "Stand-up paddling",
    WavesHorizontal,
    AverageMetric.Speed,
  ),
  [Sport.Surfing]: settings(
    "Surfing",
    WavesHorizontal,
    AverageMetric.Speed,
    false,
    ActivityMapStyle.Heatmap,
  ),
  [Sport.Swim]: settings("Swim", WavesHorizontal, AverageMetric.SwimPace),
  [Sport.TableTennis]: settings("Table tennis", HeartPulse),
  [Sport.Tennis]: settings("Tennis", HeartPulse),
  [Sport.TrailRun]: settings("Trail run", SportShoe, AverageMetric.Pace),
  [Sport.Velomobile]: settings("Velomobile", Bike, AverageMetric.Speed, true),
  [Sport.VirtualRide]: settings(
    "Virtual ride",
    Bike,
    AverageMetric.Speed,
    true,
  ),
  [Sport.VirtualRow]: settings(
    "Virtual row",
    WavesHorizontal,
    AverageMetric.Speed,
  ),
  [Sport.VirtualRun]: settings("Virtual run", SportShoe, AverageMetric.Pace),
  [Sport.Volleyball]: settings("Volleyball", HeartPulse),
  [Sport.Walk]: settings("Walk", Footprints, AverageMetric.Pace),
  [Sport.WeightTraining]: settings("Weight training", Dumbbell),
  [Sport.Wheelchair]: settings("Wheelchair", Footprints, AverageMetric.Pace),
  [Sport.Windsurf]: settings(
    "Windsurfing",
    WavesHorizontal,
    AverageMetric.Speed,
  ),
  [Sport.Workout]: settings("Workout", HeartPulse),
  [Sport.Yoga]: settings("Yoga", HeartPulse),
  [Sport.Other]: settings("Other", HeartPulse, AverageMetric.Speed),
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
