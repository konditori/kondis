import { t, type TranslationKey } from "$lib/i18n";

const BEST_EFFORT_LABELS: Readonly<Record<string, TranslationKey>> = {
  "400m": "effort_400m",
  "1k": "effort_1k",
  half_mile: "effort_half_mile",
  "1_mile": "effort_1_mile",
  "2_miles": "effort_2_miles",
  "5k": "effort_5k",
  "10k": "effort_10k",
  "15k": "effort_15k",
  "10_miles": "effort_10_miles",
  "20k": "effort_20k",
  half_marathon: "effort_half_marathon",
  "30k": "effort_30k",
  marathon: "effort_marathon",
  "50k": "effort_50k",
  longest_ride: "effort_longest_ride",
  biggest_climb: "effort_biggest_climb",
  elevation_gain: "effort_elevation_gain",
  "5_miles": "effort_5_miles",
  "40k": "effort_40k",
  "80k": "effort_80k",
  "50_miles": "effort_50_miles",
  "90k": "effort_90k",
  "100k": "effort_100k",
  "100_miles": "effort_100_miles",
  "180k": "effort_180k",
  power_5s: "effort_power_5s",
  power_15s: "effort_power_15s",
  power_30s: "effort_power_30s",
  power_1m: "effort_power_1m",
  power_2m: "effort_power_2m",
  power_3m: "effort_power_3m",
  power_5m: "effort_power_5m",
  power_8m: "effort_power_8m",
  power_10m: "effort_power_10m",
  power_15m: "effort_power_15m",
  power_20m: "effort_power_20m",
  power_30m: "effort_power_30m",
  power_45m: "effort_power_45m",
  power_1h: "effort_power_1h",
  power_2h: "effort_power_2h",
};

export function bestEffortLabel(type: string): string {
  const key = BEST_EFFORT_LABELS[type];
  return key ? t(key) : type;
}

export function bestEffortRecordName(type: string): string {
  return type === "1_mile" ? t("effort_record_mile") : bestEffortLabel(type);
}

const BEST_EFFORT_DISTANCES: Readonly<Record<string, number>> = {
  "400m": 400,
  "1k": 1000,
  half_mile: 804.672,
  "1_mile": 1609.344,
  "2_miles": 3218.688,
  "5k": 5000,
  "10k": 10_000,
  "15k": 15_000,
  "10_miles": 16_093.44,
  "20k": 20_000,
  half_marathon: 21_097.5,
  "30k": 30_000,
  marathon: 42_195,
  "50k": 50_000,
  longest_ride: Number.POSITIVE_INFINITY,
};

export function bestEffortDistance(type: string): number {
  return BEST_EFFORT_DISTANCES[type] ?? 0;
}
