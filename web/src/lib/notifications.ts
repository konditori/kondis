import { userDisplayName, type UserName } from "$lib/user-name";

export type ActivityNotification = {
  type: "activity_like" | "activity_comment" | "follow_request";
  activityName: string | null;
  actor: UserName;
};

export function notificationBadgeLabel(count: unknown): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  return count > 20 ? "20+" : String(count);
}

export function notificationSummary(
  notification: ActivityNotification,
): string {
  const actor = userDisplayName(notification.actor);
  if (notification.type === "follow_request") {
    return `${actor} sent you a follow request.`;
  }
  const activity = notification.activityName
    ? ` your activity \u201c${notification.activityName}\u201d`
    : " your activity";
  const action =
    notification.type === "activity_like" ? "liked" : "commented on";
  return `${actor} ${action}${activity}.`;
}
