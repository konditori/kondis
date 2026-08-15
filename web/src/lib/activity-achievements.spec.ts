import { describe, expect, it } from "vitest";
import {
  achievementMedalLabel,
  achievementRank,
  distinctAchievementEfforts,
} from "./activity-achievements";

const effort = (overallRank: number, yearRank: number, type = "10k") => ({
  overallRank,
  yearRank,
  type,
});

describe("activity achievements", () => {
  it("prefers the overall podium rank for a medal", () => {
    expect(achievementRank(effort(2, 1))).toBe(2);
    expect(achievementRank(effort(4, 3))).toBe(3);
  });

  it("keeps one representative of each medal rank", () => {
    expect(
      distinctAchievementEfforts([
        effort(1, 1, "power_5s"),
        effort(1, 2, "10k"),
        effort(4, 2, "power_15s"),
        effort(3, 3, "5_miles"),
      ]).map(achievementRank),
    ).toEqual([1, 2, 3]);
  });

  it("labels the three medal ranks", () => {
    expect([1, 2, 3].map(achievementMedalLabel)).toEqual([
      "Gold medal",
      "Silver medal",
      "Bronze medal",
    ]);
  });
});
