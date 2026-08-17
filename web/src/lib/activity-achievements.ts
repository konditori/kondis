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
  return [...efforts]
    .sort((a, b) => achievementRank(a) - achievementRank(b))
    .filter((effort) => {
      const rank = achievementRank(effort);
      if (seenRanks.has(rank)) return false;
      seenRanks.add(rank);
      return true;
    })
    .slice(0, 3);
}

export function shouldShowAchievementCount(
  count: number,
  efforts: AchievementEffort[],
): boolean {
  if (count <= 1) return false;

  const ranks = new Set(
    distinctAchievementEfforts(efforts).map(achievementRank),
  );
  if (count === 2 && ranks.has(2) && ranks.has(3)) return false;
  if (count === 3 && [1, 2, 3].every((rank) => ranks.has(rank))) return false;
  return true;
}
