import { describe, expect, it } from "vitest";

import { Sport } from "$lib/api";
import {
  ACTIVITY_TYPE_SETTINGS,
  ActivityMapStyle,
  AverageMetric,
  activityTypeSettings,
} from "$lib/activity-types";

describe("activity type settings", () => {
  it("displays roller skiing as pace", () => {
    expect(activityTypeSettings(Sport.RollerSki).averageMetric).toBe(
      AverageMetric.Pace,
    );
  });

  it("displays hiking as pace", () => {
    expect(activityTypeSettings(Sport.Hike).averageMetric).toBe(
      AverageMetric.Pace,
    );
  });

  it("displays neither speed nor pace for ice skating", () => {
    expect(activityTypeSettings(Sport.IceSkate).averageMetric).toBe(
      AverageMetric.None,
    );
  });

  it("displays average power for pedal-powered cycling sports", () => {
    const powerSports = new Set([
      Sport.GravelRide,
      Sport.Handcycle,
      Sport.MountainBikeRide,
      Sport.Ride,
      Sport.Velomobile,
      Sport.VirtualRide,
    ]);
    for (const sport of Object.values(Sport)) {
      expect(activityTypeSettings(sport).showAveragePower).toBe(
        powerSports.has(sport),
      );
    }
  });

  it("defines settings for every generated sport", () => {
    expect(Object.keys(ACTIVITY_TYPE_SETTINGS).sort()).toEqual(
      Object.values(Sport).sort(),
    );
  });

  it("uses density maps for sports that repeatedly cover the same area", () => {
    const heatmapSports = new Set([
      Sport.Golf,
      Sport.Sail,
      Sport.Skateboard,
      Sport.Soccer,
      Sport.Surfing,
    ]);

    for (const sport of Object.values(Sport)) {
      expect(activityTypeSettings(sport).mapStyle).toBe(
        heatmapSports.has(sport)
          ? ActivityMapStyle.Heatmap
          : ActivityMapStyle.Route,
      );
    }
  });
});
