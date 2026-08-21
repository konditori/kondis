import { describe, expect, it } from "vitest";

import { resolveLocale } from "$lib/i18n";

describe("resolveLocale", () => {
  it("selects a supported regional language", () => {
    expect(resolveLocale("sv-SE,sv;q=0.9,en;q=0.8")).toBe("sv");
  });

  it("honors language quality", () => {
    expect(resolveLocale("en;q=0.5,sv;q=1")).toBe("sv");
  });

  it("falls back to English", () => {
    expect(resolveLocale("fr-FR,*;q=0.5")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });
});
