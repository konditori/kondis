import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

const API_PREFIX = "api/v1";

export function apiUrl(path: string): URL {
  const apiBase = env.KONDIS_API_URL ?? "http://localhost:2293";
  return new URL(path.replace(/^\//, ""), `${apiBase.replace(/\/$/, "")}/`);
}

export function getServerSdkRequestOptions(fetchImpl: typeof fetch) {
  return {
    baseUrl: apiUrl(API_PREFIX).toString(),
    fetch: fetchImpl,
  };
}

export function apiEndpointUrl(path: string): URL {
  return apiUrl(`api/${path.replace(/^\//, "")}`);
}

export function activityEventsUrl(
  requestUrl: URL,
  forwardedProto?: string | null,
  cfVisitor?: string | null,
  forwardedHost?: string | null,
): string {
  const url = new URL(requestUrl);
  const cloudflareScheme = cfVisitor?.match(/"scheme"\s*:\s*"(https?)"/)?.[1];
  const proxyProto = forwardedProto?.split(",", 1)[0]?.trim().toLowerCase();
  const proxyHost = forwardedHost?.split(",", 1)[0]?.trim().toLowerCase();
  const secure =
    cloudflareScheme === "https" ||
    (cloudflareScheme == null && proxyProto === "https") ||
    (cloudflareScheme == null &&
      proxyProto == null &&
      url.protocol === "https:") ||
    (proxyHost?.split(":", 1)[0] ?? url.hostname) === "kondis-dev.jogenfors.se";
  const configured = publicEnv.PUBLIC_KONDIS_EVENTS_URL;
  if (configured) {
    const eventsUrl = new URL(configured, requestUrl);
    if (eventsUrl.hostname === requestUrl.hostname) {
      eventsUrl.protocol = secure ? "wss:" : "ws:";
      eventsUrl.port = secure ? "" : "2293";
    }
    return eventsUrl.toString();
  }

  url.protocol = secure ? "wss:" : "ws:";
  if (!secure) url.port = "2293";
  url.pathname = "/events";
  url.search = "";
  url.hash = "";
  return url.toString();
}
