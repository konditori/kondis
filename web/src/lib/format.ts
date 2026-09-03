import type { ActivityType } from "$lib/types";
import type { BestEffortValueKind } from "$lib/types";
import type { UnitSystem } from "$lib/units";

const METERS_PER_MILE = 1609.344;
const METERS_PER_YARD = 0.9144;
const FEET_PER_METER = 3.28084;
const MILES_PER_HOUR_PER_METER_PER_SECOND = 2.236936;
const RELATIVE_TIME_MAX_AGE_SECONDS = 7 * 86_400;
const RELATIVE_TIME_FUTURE_TOLERANCE_SECONDS = 60;

export function activityName(activity: {
  name: string | null;
  sport: ActivityType;
}): string {
  if (activity.name) return activity.name;
  return activity.sport
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function distance(value: number | null, unitSystem: UnitSystem): string {
  if (value == null) return "—";
  const converted =
    unitSystem === "metric" ? value / 1000 : value / METERS_PER_MILE;
  const unit = unitSystem === "metric" ? "km" : "mi";
  return `${converted.toFixed(converted >= 10 ? 1 : 2)} ${unit}`;
}

export function elevation(
  value: number | null,
  unitSystem: UnitSystem,
): string {
  if (value == null) return "—";
  return unitSystem === "metric"
    ? `${Math.round(value)} m`
    : `${Math.round(value * FEET_PER_METER)} ft`;
}

export function duration(seconds: number | null): string {
  if (seconds == null) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function ordinal(value: number): string {
  const lastTwoDigits = value % 100;
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
}

export function speed(value: number | null, unitSystem: UnitSystem): string {
  if (value == null) return "—";
  return unitSystem === "metric"
    ? `${(value * 3.6).toFixed(1)} km/h`
    : `${(value * MILES_PER_HOUR_PER_METER_PER_SECOND).toFixed(1)} mph`;
}

export function pace(
  value: number | null,
  unitSystem: UnitSystem,
  swimming = false,
): string {
  if (value == null || value <= 0 || !Number.isFinite(value)) return "—";
  const distanceMeters = swimming
    ? unitSystem === "metric"
      ? 100
      : 100 * METERS_PER_YARD
    : unitSystem === "metric"
      ? 1000
      : METERS_PER_MILE;
  const unit = swimming
    ? unitSystem === "metric"
      ? "100m"
      : "100yd"
    : unitSystem === "metric"
      ? "km"
      : "mi";
  const paceSeconds = Math.round(distanceMeters / value);
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = paceSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} min/${unit}`;
}

export function effortDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  return hours
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
    : `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function bestEffortValue(
  value: number,
  kind: BestEffortValueKind,
  unitSystem: UnitSystem,
): string {
  switch (kind) {
    case "duration":
      return effortDuration(value);
    case "distance":
      return distance(value, unitSystem);
    case "elevation":
      return elevation(value, unitSystem);
    case "power":
      return `${Math.round(value)} W`;
  }
}

export function localDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const dayStart = (source: Date) =>
    new Date(
      source.getFullYear(),
      source.getMonth(),
      source.getDate(),
    ).getTime();
  const dayDifference = Math.round(
    (dayStart(today) - dayStart(date)) / 86_400_000,
  );

  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  if (dayDifference === -1) return "Tomorrow";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function localTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function relativeTime(
  value: string | Date,
  now = new Date(),
  options: { justNowSeconds?: number; showSeconds?: boolean } = {},
): string {
  const { justNowSeconds = 45, showSeconds = false } = options;
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(value).getTime()) / 1000),
  );
  if (seconds < justNowSeconds) return "Just now";
  if (showSeconds && seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 90) return "1 minute ago";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 45) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (minutes < 90) return "1 hour ago";

  const hours = Math.floor(minutes / 60);
  if (hours < 22) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (hours < 36) return "1 day ago";

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 14) return "1 week ago";

  const weeks = Math.floor(days / 7);
  if (days < 28) return `${weeks} weeks ago`;
  if (days < 60) return "1 month ago";

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  if (days < 730) return "1 year ago";
  return `${Math.floor(days / 365)} years ago`;
}

export function relativeOrDateTime(
  value: string | Date,
  now = new Date(),
  options: { justNowSeconds?: number; showSeconds?: boolean } = {},
): string {
  const timestamp = new Date(value);
  const ageInSeconds = (now.getTime() - timestamp.getTime()) / 1000;

  if (
    ageInSeconds > -RELATIVE_TIME_FUTURE_TOLERANCE_SECONDS &&
    ageInSeconds < RELATIVE_TIME_MAX_AGE_SECONDS
  ) {
    return relativeTime(timestamp, now, options);
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(timestamp);
}
