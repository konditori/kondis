import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("kondis_session");
  const service = event.platform?.env.KONDIS_API;
  const upstreamFetch: typeof fetch = service
    ? service.fetch.bind(service)
    : globalThis.fetch.bind(globalThis);
  event.locals.kondisFetch = (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (service && url.pathname.startsWith("/api/v1/")) {
      url.pathname = url.pathname.slice("/api/v1".length);
    }
    const headers = new Headers(request.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return upstreamFetch(new Request(new Request(url, request), { headers }));
  };
  return resolve(event);
};
