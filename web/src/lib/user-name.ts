export type UserName = { firstName: string; lastName: string };

export function userDisplayName(user: UserName): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function userPossessiveName(user: UserName): string {
  return `${user.firstName}${user.firstName.endsWith("s") ? "'" : "'s"}`;
}
