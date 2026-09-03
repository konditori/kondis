import { describe, expect, it } from "vitest";

import {
  distance,
  duration,
  elevation,
  ordinal,
  pace,
  relativeOrDateTime,
  relativeTime,
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

  it("formats relative timestamps", () => {
    const now = new Date("2026-08-18T10:00:00.000Z");
    expect(relativeTime("2026-08-18T09:59:40.000Z", now)).toBe("Just now");
    expect(
      relativeTime("2026-08-18T09:59:54.000Z", now, {
        justNowSeconds: 5,
        showSeconds: true,
      }),
    ).toBe("6 seconds ago");
    expect(relativeTime("2026-08-18T09:58:30.000Z", now)).toBe("1 minute ago");
    expect(relativeTime("2026-08-18T09:55:00.000Z", now)).toBe("5 minutes ago");
    expect(relativeTime("2026-08-18T08:30:00.000Z", now)).toBe("1 hour ago");
    expect(relativeTime("2026-08-16T10:00:00.000Z", now)).toBe("2 days ago");
    expect(relativeTime("2026-07-18T10:00:00.000Z", now)).toBe("1 month ago");
    expect(relativeTime("2025-08-18T10:00:00.000Z", now)).toBe("1 year ago");
  });

  it("uses relative timestamps only for recent values", () => {
    const now = new Date("2026-08-18T10:00:00.000Z");
    expect(relativeOrDateTime("2026-08-18T10:00:00.250Z", now)).toBe(
      "Just now",
    );
    expect(relativeOrDateTime("2026-08-17T10:00:00.000Z", now)).toBe(
      "1 day ago",
    );
    expect(relativeOrDateTime("2026-08-10T10:00:00.000Z", now)).toBe(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date("2026-08-10T10:00:00.000Z")),
    );
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
