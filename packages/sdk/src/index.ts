import { SUCCESS_CODES } from '@oazapfts/runtime';

import { defaults } from './fetch-client.js';

export * from './fetch-client.js';

// @oazapfts/runtime omits Partial Content from its optimistic success list.
if (!(SUCCESS_CODES as readonly number[]).includes(206)) {
  (SUCCESS_CODES as unknown as number[]).push(206);
}

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
