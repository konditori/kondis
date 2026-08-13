import type { Handle } from "@sveltejs/kit";

// SvelteKit replaces global fetch while it renders a page in development. Keep
// the runtime implementation for calls to the separate Kondis API service.
const kondisFetch: typeof fetch = globalThis.fetch.bind(globalThis);

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.kondisFetch = kondisFetch;
  return resolve(event);
};
