import { describe, expect, it } from "vitest";

import { Sport } from "$lib/api";
import {
  ACTIVITY_TYPE_PRESENTATION,
  ActivityMapStyle,
} from "$lib/activity-types";

describe("activity type presentation", () => {
  it("defines presentation for every generated sport", () => {
    expect(Object.keys(ACTIVITY_TYPE_PRESENTATION).sort()).toEqual(
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
      expect(ACTIVITY_TYPE_PRESENTATION[sport].mapStyle).toBe(
        heatmapSports.has(sport)
          ? ActivityMapStyle.Heatmap
          : ActivityMapStyle.Route,
      );
    }
  });
});
