const BEST_EFFORT_LABELS: Readonly<Record<string, string>> = {
  "400m": "400 m",
  "1k": "1K",
  half_mile: "1/2 mile",
  "1_mile": "1 mile",
  "2_miles": "2 miles",
  "5k": "5K",
  "10k": "10K",
  "15k": "15K",
  "10_miles": "10 miles",
  "20k": "20K",
  half_marathon: "Half marathon",
  "30k": "30K",
  marathon: "Marathon",
  "50k": "50K",
  longest_ride: "Longest ride",
  biggest_climb: "Biggest climb",
  elevation_gain: "Elevation gain",
  "5_miles": "5 miles",
  "40k": "40K",
  "80k": "80K",
  "50_miles": "50 miles",
  "90k": "90K",
  "100k": "100K",
  "100_miles": "100 miles",
  "180k": "180K",
  power_5s: "5 sec power",
  power_15s: "15 sec power",
  power_30s: "30 sec power",
  power_1m: "1 min power",
  power_2m: "2 min power",
  power_3m: "3 min power",
  power_5m: "5 min power",
  power_8m: "8 min power",
  power_10m: "10 min power",
  power_15m: "15 min power",
  power_20m: "20 min power",
  power_30m: "30 min power",
  power_45m: "45 min power",
  power_1h: "1 hour power",
  power_2h: "2 hour power",
};

export function bestEffortLabel(type: string): string {
  return BEST_EFFORT_LABELS[type] ?? type;
}

export function bestEffortRecordName(type: string): string {
  const label = bestEffortLabel(type);
  return type === "1_mile" ? "mile" : label;
}
