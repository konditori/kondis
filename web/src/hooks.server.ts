import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("kondis_session");
  const service = import.meta.env.DEV
    ? undefined
    : event.platform?.env.KONDIS_API;
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
    console.log("API Worker realtime response", {
      pathname,
      status: response.status,
    });
    return response;
  }
  const upstreamFetch: typeof fetch = service
    ? service.fetch.bind(service)
    : globalThis.fetch.bind(globalThis);
  event.locals.kondisFetch = (input, requestInit) => {
    const request = new Request(input, requestInit);
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    const upstreamInit: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    };
    if (request.body) upstreamInit.duplex = "half";
    return upstreamFetch(url.toString(), upstreamInit);
  };
  const isDemoPage =
    event.platform?.env.KONDIS_DEMO_MODE === "true" &&
    event.request.method === "GET" &&
    !pathname.startsWith("/api/") &&
    pathname !== "/events";
  const isAuthenticationPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/");
  if (isAuthenticationPage) {
    // Let's not cache auth pages
    event.setHeaders({
      "cache-control": "no-store, no-cache, max-age=0, must-revalidate",
    });
  } else if (isDemoPage) {
    // The demo site is heavily cached, so we want different rules than the default
    event.setHeaders({
      "cache-control": "no-cache",
      "cloudflare-cdn-cache-control":
        "public, max-age=86400, stale-while-revalidate=604800",
    });
  }
  const response = await resolve(event);
  if (response.headers.get("x-kondis-cache-bypass") !== "1") {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete("x-kondis-cache-bypass");
  headers.delete("cloudflare-cdn-cache-control");
  headers.set(
    "cache-control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
