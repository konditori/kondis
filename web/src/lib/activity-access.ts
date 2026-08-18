export function canEditActivity(
  activityUserId: string | null | undefined,
  viewerId: string | null | undefined,
): boolean {
  return Boolean(activityUserId && viewerId && activityUserId === viewerId);
}
