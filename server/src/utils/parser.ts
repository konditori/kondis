import type { MaybeArray } from 'src/types';

export const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

export const asArray = <T>(value: MaybeArray<T>): T[] => {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

export const firstObject = (value: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!value) {
    return undefined;
  }

  for (const candidate of Object.values(value)) {
    const parsed = asRecord(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
};

export const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

export const toInteger = (value: unknown): number | undefined => {
  const parsed = toNumber(value);
  return parsed === undefined ? undefined : Math.round(parsed);
};

export const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const normalizeSport = (value: unknown): string => {
  if (typeof value !== 'string') {
    return 'unknown';
  }

  return value.trim().toLowerCase() || 'unknown';
};
