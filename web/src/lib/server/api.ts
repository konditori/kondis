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

export function activityEventsUrl(requestUrl: URL): string {
  if (publicEnv.PUBLIC_KONDIS_EVENTS_URL)
    return publicEnv.PUBLIC_KONDIS_EVENTS_URL;

  const url = new URL(requestUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.port = "2293";
  url.pathname = "/events";
  url.search = "";
  url.hash = "";
  return url.toString();
}
