import { describe, expect, it } from "vitest";

import {
  notificationBadgeLabel,
  notificationSummary,
} from "$lib/notifications";

describe("notificationSummary", () => {
  it("summarizes likes and comments with the actor's full name", () => {
    const actor = { firstName: "John", lastName: "Doe" };
    expect(
      notificationSummary({
        type: "activity_like",
        activityName: "Morning Run",
        actor,
      }),
    ).toBe("John Doe liked your activity \u201cMorning Run\u201d.");
    expect(
      notificationSummary({
        type: "activity_comment",
        activityName: null,
        actor,
      }),
    ).toBe("John Doe commented on your activity.");
  });

  it("summarizes follow requests", () => {
    const actor = { firstName: "John", lastName: "Doe" };
    expect(
      notificationSummary({
        type: "follow_request",
        activityName: null,
        actor,
      }),
    ).toBe("John Doe sent you a follow request.");
  });
});

describe("notificationBadgeLabel", () => {
  it("caps large notification counts at 20+", () => {
    expect(notificationBadgeLabel(0)).toBeNull();
    expect(notificationBadgeLabel(3)).toBe("3");
    expect(notificationBadgeLabel(20)).toBe("20");
    expect(notificationBadgeLabel(21)).toBe("20+");
    expect(notificationBadgeLabel(undefined)).toBeNull();
    expect(notificationBadgeLabel(null)).toBeNull();
    expect(notificationBadgeLabel("4")).toBeNull();
  });
});
