export class KondisStartupError extends Error {}

export const asErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
