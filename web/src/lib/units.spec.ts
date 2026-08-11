import { describe, expect, it } from "vitest";

import { parseUnitSystem } from "$lib/units";

describe("parseUnitSystem", () => {
  it("accepts supported unit systems", () => {
    expect(parseUnitSystem("metric")).toBe("metric");
    expect(parseUnitSystem("imperial")).toBe("imperial");
  });

  it("rejects missing and unsupported values", () => {
    expect(parseUnitSystem(undefined)).toBeUndefined();
    expect(parseUnitSystem("nautical")).toBeUndefined();
  });
});
