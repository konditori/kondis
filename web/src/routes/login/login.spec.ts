import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";

import { actions, load } from "./+page.server";

const returnTo =
  "/settings/connections/authorize?client_id=test&state=oauth-state";

describe("login continuation", () => {
  it("carries a valid connection authorization destination into the form", async () => {
    const result = await load({
      locals: {
        kondisFetch: vi.fn(() =>
          Promise.resolve(
            Response.json({
              setupRequired: false,
              registrationEnabled: false,
            }),
          ),
        ),
      },
      url: new URL(
        `https://fitness.example/login?returnTo=${encodeURIComponent(returnTo)}`,
      ),
    } as never);

    expect(result).toMatchObject({ returnTo });
  });

  it("redirects to the submitted authorization destination after login", async () => {
    const form = new FormData();
    form.set("email", "user@example.com");
    form.set("password", "long enough password");
    form.set("returnTo", returnTo);

    try {
      await actions.login({
        request: new Request("https://fitness.example/login?/login", {
          method: "POST",
          body: form,
        }),
        cookies: { set: vi.fn() },
        fetch: vi.fn(() =>
          Promise.resolve(Response.json({ accessToken: "session-token" })),
        ),
        url: new URL("https://fitness.example/login?/login"),
      } as never);
      throw new Error("Expected login to redirect");
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      expect(error).toMatchObject({ status: 303, location: returnTo });
    }
  });

  it("rejects an unrelated submitted destination", async () => {
    const form = new FormData();
    form.set("email", "user@example.com");
    form.set("password", "long enough password");
    form.set("returnTo", "https://attacker.example");

    await expect(
      actions.login({
        request: new Request("https://fitness.example/login?/login", {
          method: "POST",
          body: form,
        }),
        cookies: { set: vi.fn() },
        fetch: vi.fn(() =>
          Promise.resolve(Response.json({ accessToken: "session-token" })),
        ),
        url: new URL("https://fitness.example/login?/login"),
      } as never),
    ).rejects.toMatchObject({ status: 303, location: "/" });
  });
});
