import {
  Bike,
  Dumbbell,
  Footprints,
  Mountain,
  PersonStanding,
  Waves,
} from "@lucide/svelte";
import type { ActivityType } from "$lib/types";

export function activityName(activity: {
  name: string | null;
  sport: ActivityType;
}): string {
  if (activity.name) return activity.name;
  return activity.sport
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function sportIcon(sport: ActivityType) {
  if (sport === "ride") return Bike;
  if (sport === "run" || sport === "trail_run" || sport === "walk")
    return Footprints;
  if (sport === "swim") return Waves;
  if (["alpine_ski", "roller_ski", "cross_country_ski"].includes(sport))
    return Mountain;
  if (sport === "other") return Dumbbell;
  return PersonStanding;
}

export function distance(value: number | null): string {
  return value == null
    ? "—"
    : `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} km`;
}

export function duration(seconds: number | null): string {
  if (seconds == null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours
    ? `${hours}h ${minutes.toString().padStart(2, "0")}m`
    : `${minutes} min`;
}

export function speed(value: number | null): string {
  return value == null ? "—" : `${(value * 3.6).toFixed(1)} km/h`;
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

export function effortPace(
  elapsedTime: number,
  distanceMeters: number,
): string {
  const secondsPerKm = Math.round((elapsedTime / distanceMeters) * 1000);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} /km`;
}

export function localDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function localTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
