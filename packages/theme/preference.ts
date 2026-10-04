export type ThemePreference = "system" | "light" | "dark";

const storageKey = "kondis-theme";

export function observeTheme(onChange: (preference: ThemePreference) => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let preference: ThemePreference = "system";

  function readPreference(): ThemePreference {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  }

  function apply() {
    document.documentElement.dataset.theme =
      preference === "system" ? (media.matches ? "dark" : "light") : preference;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        getComputedStyle(document.documentElement)
          .getPropertyValue("--page")
          .trim(),
      );
    onChange(preference);
  }

  function set(next: ThemePreference) {
    preference = next;
    try {
      if (next === "system") localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, next);
    } catch {
      // Appearance remains usable when persistent storage is unavailable.
    }
    apply();
  }

  function syncStorage(event: StorageEvent) {
    if (event.key === storageKey || event.key === null) {
      preference = readPreference();
      apply();
    }
  }

  preference = readPreference();
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("storage", syncStorage);
  return {
    set,
    destroy() {
      media.removeEventListener("change", apply);
      window.removeEventListener("storage", syncStorage);
    },
  };
}
