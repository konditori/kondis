import { z } from '@hono/zod-openapi';

export const CredentialsSchema = z.object({
  email: z.string().max(254),
  firstName: z.string().max(200).optional(),
  lastName: z.string().max(200).optional(),
  password: z.string().max(1024),
});
export const SetupCredentialsSchema = CredentialsSchema.extend({ setupTicket: z.string().min(1).max(512) });
export const SetupTokenCredentialsSchema = z.object({ setupToken: z.string().min(1).max(512) });
export const SetupTicketCredentialsSchema = z.object({ setupTicket: z.string().min(1).max(512) });
export const RegistrationCredentialsSchema = z.object({
  email: z.string().max(254),
  firstName: z.string().max(200),
  lastName: z.string().max(200),
  password: z.string().max(1024),
});

export const AuthCapabilitiesSchema = z.object({ direct: z.literal(true) });
export const SetupStatusSchema = z.object({
  setupRequired: z.boolean(),
  registrationEnabled: z.boolean(),
});
export const SetupTicketSchema = z.object({
  token: z.string().min(20),
  expiresAt: z.string().datetime(),
});
export const SetupValidationSchema = z.object({ valid: z.literal(true) });
export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['admin', 'user']),
  avatarUrl: z.string().nullable(),
});
export const AuthSessionSchema = z.object({
  accessToken: z.string(),
  setup: z.boolean(),
  user: AuthUserSchema,
});

export const ActivityEventsTicketSchema = z.object({
  token: z.string().min(20),
  expiresAt: z.string().datetime(),
});

export type ActivityEventsTicketDto = z.output<typeof ActivityEventsTicketSchema>;
