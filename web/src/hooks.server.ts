import type { Handle } from "@sveltejs/kit";

const kondisFetch: typeof fetch = globalThis.fetch.bind(globalThis);

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("kondis_session");
  event.locals.kondisFetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return kondisFetch(input, { ...init, headers });
  };
  return resolve(event);
};
