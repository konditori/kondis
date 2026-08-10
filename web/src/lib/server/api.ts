import { env } from "$env/dynamic/private";

export function apiUrl(path: string): URL {
  const apiBase = env.KONDIS_API_URL ?? "http://localhost:2293";
  return new URL(path.replace(/^\//, ""), `${apiBase.replace(/\/$/, "")}/`);
}
