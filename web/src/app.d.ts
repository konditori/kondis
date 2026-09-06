declare global {
  namespace App {
    interface Platform {
      env: {
        KONDIS_API: {
          fetch(
            input: RequestInfo | URL,
            init?: RequestInit,
          ): Promise<Response>;
        };
      };
    }

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
