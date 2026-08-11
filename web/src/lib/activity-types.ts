import { Sport } from "$lib/api";
import type { ActivityType } from "$lib/types";

export const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: Sport.Run, label: "Run" },
  { value: Sport.Ride, label: "Ride" },
  { value: Sport.TrailRun, label: "Trail run" },
  { value: Sport.Walk, label: "Walk" },
  { value: Sport.Hike, label: "Hike" },
  { value: Sport.Swim, label: "Swim" },
  { value: Sport.AlpineSki, label: "Alpine skiing" },
  { value: Sport.RollerSki, label: "Roller skiing" },
  { value: Sport.CrossCountrySki, label: "Cross-country skiing" },
  { value: Sport.Other, label: "Other" },
];

export const activityTypeLabel = (type: ActivityType): string =>
  ACTIVITY_TYPE_OPTIONS.find(({ value }) => value === type)?.label ?? "Other";

export const activityUsesPace = (type: ActivityType): boolean =>
  type === Sport.Run ||
  type === Sport.TrailRun ||
  type === Sport.Walk ||
  type === Sport.Hike ||
  type === Sport.Swim ||
  type === Sport.RollerSki;
