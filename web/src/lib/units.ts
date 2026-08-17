export const UNIT_SYSTEMS = ["metric", "imperial"] as const;

export type UnitSystem = (typeof UNIT_SYSTEMS)[number];
type UnitSystemInput = string | File | null | undefined;

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "metric";
export const UNIT_SYSTEM_COOKIE = "kondis_units";

export const parseUnitSystem = (
  value: UnitSystemInput,
): UnitSystem | undefined =>
  UNIT_SYSTEMS.find((unitSystem) => unitSystem === value);
