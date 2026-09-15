import { ForbiddenException } from 'src/errors';
import { z } from 'zod';

export const SCOPES = [
  'profile:read',
  'activities:read',
  'activities:write',
  'activities:import',
  'location:read',
] as const;
export const ScopeSchema = z.enum(SCOPES);
export type Scope = z.infer<typeof ScopeSchema>;
export type Principal = { userId: string; credentialId: string | null; scopes: ReadonlySet<Scope>; demo?: boolean };

export function requireScope(principal: Principal, scope: Scope): void {
  if (
    !principal.userId ||
    !principal.scopes.has(scope) ||
    (principal.demo && ['activities:write', 'activities:import'].includes(scope))
  ) {
    throw new ForbiddenException(`Required scope: ${scope}`);
  }
}

export const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, '0')).join('');
export const hash = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
export const timezoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Use an IANA timezone');
