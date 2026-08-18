import { describe, expect, it } from "vitest";

import { canEditActivity } from "$lib/activity-access";

describe("canEditActivity", () => {
  it("only allows the activity owner to edit", () => {
    expect(canEditActivity("owner", "owner")).toBe(true);
    expect(canEditActivity("owner", "viewer")).toBe(false);
    expect(canEditActivity("owner", undefined)).toBe(false);
  });
});
