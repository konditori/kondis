import { describe, expect, it } from "vitest";

import {
  distance,
  duration,
  elevation,
  ordinal,
  pace,
  speed,
} from "$lib/format";

describe("unit-aware activity formatting", () => {
  it("formats ordinal numbers", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
    ]);
  });

  it("formats metric measurements", () => {
    expect(distance(5000, "metric")).toBe("5.00 km");
    expect(elevation(100, "metric")).toBe("100 m");
    expect(speed(10, "metric")).toBe("36.0 km/h");
    expect(pace(1000 / 300, "metric")).toBe("5:00 min/km");
    expect(pace(1, "metric", true)).toBe("1:40 min/100m");
    expect(duration(26 * 60)).toBe("26:00");
    expect(duration(3661)).toBe("61:01");
  });

  it("formats imperial measurements from the same stored SI values", () => {
    expect(distance(5000, "imperial")).toBe("3.11 mi");
    expect(elevation(100, "imperial")).toBe("328 ft");
    expect(speed(10, "imperial")).toBe("22.4 mph");
    expect(pace(1000 / 300, "imperial")).toBe("8:03 min/mi");
    expect(pace(1, "imperial", true)).toBe("1:31 min/100yd");
  });

  it("does not render missing or invalid measurements", () => {
    expect(distance(null, "metric")).toBe("—");
    expect(elevation(null, "imperial")).toBe("—");
    expect(speed(null, "metric")).toBe("—");
    expect(pace(0, "imperial")).toBe("—");
  });
});
