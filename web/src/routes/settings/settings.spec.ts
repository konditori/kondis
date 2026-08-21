import { describe, expect, it, vi } from "vitest";

import { UNIT_SYSTEM_COOKIE } from "$lib/units";
import { load } from "../+layout.server";
import { actions } from "./+page.server";

describe("unit preference settings", () => {
  it("defaults to metric and reads a valid preference during SSR", async () => {
    const get = vi
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce("imperial");
    const kondisFetch = vi.fn(() =>
      Promise.resolve(
        new Response("[]", { headers: { "content-type": "application/json" } }),
      ),
    );
    const event = () => ({ cookies: { get }, locals: { kondisFetch } });

    expect(await load(event() as never)).toEqual({
      user: undefined,
      authenticated: true,
      unitSystem: "metric",
      activityTypes: [],
    });
    expect(await load(event() as never)).toEqual({
      user: undefined,
      authenticated: true,
      unitSystem: "imperial",
      activityTypes: [],
    });
  });

  it("persists a valid preference in an SSR-readable cookie", async () => {
    const formData = new FormData();
    formData.set("unitSystem", "imperial");
    const set = vi.fn();

    await expect(
      actions.default({
        cookies: { set },
        request: new Request("http://localhost/settings", {
          method: "POST",
          body: formData,
        }),
        url: new URL("http://localhost/settings"),
      } as never),
    ).resolves.toEqual({ saved: true });

    expect(set).toHaveBeenCalledWith(
      UNIT_SYSTEM_COOKIE,
      "imperial",
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax" }),
    );
  });

  it("rejects unsupported preferences", async () => {
    const formData = new FormData();
    formData.set("unitSystem", "nautical");

    await expect(
      actions.default({
        cookies: { set: vi.fn() },
        request: new Request("http://localhost/settings", {
          method: "POST",
          body: formData,
        }),
        url: new URL("http://localhost/settings"),
      } as never),
    ).resolves.toMatchObject({ status: 400 });
  });
});
