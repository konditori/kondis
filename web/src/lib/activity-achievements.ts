export type AchievementEffort = {
  overallRank: number;
  yearRank: number;
  type: string;
};

export function achievementRank(effort: AchievementEffort): number {
  return effort.overallRank <= 3 ? effort.overallRank : effort.yearRank;
}

export function achievementMedalLabel(rank: number): string {
  return rank === 1
    ? "Gold medal"
    : rank === 2
      ? "Silver medal"
      : "Bronze medal";
}

export function distinctAchievementEfforts<T extends AchievementEffort>(
  efforts: T[],
): T[] {
  const seenRanks = new Set<number>();
  return efforts
    .filter((effort) => {
      const rank = achievementRank(effort);
      if (seenRanks.has(rank)) return false;
      seenRanks.add(rank);
      return true;
    })
    .slice(0, 3);
}
