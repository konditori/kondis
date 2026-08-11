import { describe, expect, it } from "vitest";

import { Sport } from "$lib/api";
import { activityUsesPace } from "$lib/activity-types";

describe("activityUsesPace", () => {
  it("displays roller skiing as pace", () => {
    expect(activityUsesPace(Sport.RollerSki)).toBe(true);
  });

  it("displays hiking as pace", () => {
    expect(activityUsesPace(Sport.Hike)).toBe(true);
  });

  it("continues to display riding and alpine skiing as speed", () => {
    expect(activityUsesPace(Sport.Ride)).toBe(false);
    expect(activityUsesPace(Sport.AlpineSki)).toBe(false);
  });
});
