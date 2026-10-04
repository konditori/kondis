import { describe, expect, it } from "vitest";
import { resolveLocale } from "./locale";

describe("request locale", () => {
  it("matches regional languages and respects quality values", () => {
    expect(resolveLocale("de-DE, sv-SE;q=0.9, en;q=0.5")).toBe("sv");
    expect(resolveLocale("sv;q=0.4,en-US;q=0.8")).toBe("en");
  });
  it("ignores refused languages and malformed quality values", () => {
    expect(resolveLocale("sv;q=0,en;q=1")).toBe("en");
    expect(resolveLocale("sv;q=invalid,en")).toBe("en");
    expect(resolveLocale("sv;q=2,en")).toBe("en");
  });
  it("honors an explicit supported preference and falls back safely", () => {
    expect(resolveLocale("en", "sv")).toBe("sv");
    expect(resolveLocale("sv", "unknown")).toBe("sv");
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale("fr, de")).toBe("en");
  });
});
