import { defaults } from './fetch-client.js';

export * from './fetch-client.js';

export interface InitOptions {
  baseUrl: string;
  token?: string;
  headers?: Record<string, string>;
}

export function init({ baseUrl, token, headers }: InitOptions): void {
  defaults.baseUrl = baseUrl.replace(/\/$/, '');
  defaults.headers = { ...headers };
  if (token) defaults.headers.Authorization = `Bearer ${token}`;
}

export function getBaseUrl(): string {
  return defaults.baseUrl;
}
