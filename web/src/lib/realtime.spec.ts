import { describe, expect, it } from "vitest";
import { parseNotificationEvent } from "$lib/realtime";

describe("parseNotificationEvent", () => {
  it("recognizes a like notification created event", () => {
    expect(
      parseNotificationEvent(
        JSON.stringify({
          type: "notification.created",
          notification: {
            recipientId: "recipient-id",
            id: "notification-id",
            type: "activity_like",
            createdAt: "2026-08-18T12:00:00.000Z",
            activityId: "activity-id",
          },
        }),
      ),
    ).toMatchObject({
      type: "notification.created",
      notification: {
        id: "notification-id",
        type: "activity_like",
      },
    });
  });

  it("ignores malformed notification messages", () => {
    expect(parseNotificationEvent("not json")).toBeNull();
    expect(
      parseNotificationEvent(
        JSON.stringify({ type: "notification.created", notification: {} }),
      ),
    ).toBeNull();
  });
});
