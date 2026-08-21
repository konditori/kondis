declare global {
  namespace App {
    interface Locals {
      /** Native runtime fetch captured before SvelteKit's development SSR wrapper. */
      kondisFetch: typeof fetch;
      locale: import("$lib/i18n").Locale;
    }

    interface PageState {
      fromActivityList?: boolean;
    }
  }
}

export {};
