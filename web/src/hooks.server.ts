import type { Handle } from "@sveltejs/kit";
import { resolveLocale } from "$lib/i18n";

const kondisFetch: typeof fetch = globalThis.fetch.bind(globalThis);

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("kondis_session");
  event.locals.locale = resolveLocale(
    event.request.headers.get("accept-language"),
  );
  event.locals.kondisFetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return kondisFetch(input, { ...init, headers });
  };
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('<html lang="en">', `<html lang="${event.locals.locale}">`),
  });
};
