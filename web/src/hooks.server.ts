import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("kondis_session");
  const service = event.platform?.env.KONDIS_API;
  const pathname = new URL(event.request.url).pathname;
  const isRealtimeUpgrade =
    (pathname === "/events" || pathname === "/api/v1/events") &&
    event.request.headers.get("Upgrade")?.toLowerCase() === "websocket";
  if (service && isRealtimeUpgrade) {
    console.log("Forwarding realtime WebSocket upgrade to API Worker", {
      method: event.request.method,
      pathname,
    });
    const response = await service.fetch(event.request);
    console.log("API Worker realtime response", { pathname, status: response.status });
    return response;
  }
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
