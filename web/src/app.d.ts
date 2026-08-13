declare global {
  namespace App {
    interface Locals {
      /** Native runtime fetch captured before SvelteKit's development SSR wrapper. */
      kondisFetch: typeof fetch;
    }

    interface PageState {
      fromActivityList?: boolean;
    }
  }
}

export {};
