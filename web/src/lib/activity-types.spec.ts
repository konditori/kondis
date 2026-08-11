import { describe, expect, it } from "vitest";

import { Sport } from "$lib/api";
import {
  ACTIVITY_TYPE_SETTINGS,
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

  it("displays average power only for rides", () => {
    for (const sport of Object.values(Sport)) {
      expect(activityTypeSettings(sport).showAveragePower).toBe(
        sport === Sport.Ride,
      );
    }
  });

  it("defines settings for every generated sport", () => {
    expect(Object.keys(ACTIVITY_TYPE_SETTINGS).sort()).toEqual(
      Object.values(Sport).sort(),
    );
  });
});
