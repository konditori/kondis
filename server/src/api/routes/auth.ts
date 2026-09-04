import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import type { ApiEnv, ApiUserLookup } from 'src/api/auth';
import { jsonBodyMiddleware } from 'src/api/validation';
import {
  ActivityEventsTicketSchema,
  AuthCapabilitiesSchema,
  AuthSessionSchema,
  AuthUserSchema,
  CredentialsSchema,
  RegistrationCredentialsSchema,
  SetupCredentialsSchema,
  SetupStatusSchema,
  SetupTicketCredentialsSchema,
  SetupTicketSchema,
  SetupTokenCredentialsSchema,
  SetupValidationSchema,
} from 'src/dtos/auth.dto';
import { ForbiddenException, UnauthorizedException } from 'src/errors';
import type { ConfigPort } from 'src/ports/config.port';
import type { AuthService } from 'src/services/auth.service';

export type AuthRouteService = Pick<
  AuthService,
  | 'createActivityEventsTicket'
  | 'createJobEventsTicket'
  | 'login'
  | 'register'
  | 'setup'
  | 'setupStatus'
  | 'validateSetupTicket'
  | 'verifySetupToken'
>;

const credentialsInput = CredentialsSchema.openapi('CredentialsDto');
const registrationCredentialsInput = RegistrationCredentialsSchema.openapi('RegistrationCredentialsDto');
const setupCredentialsInput = SetupCredentialsSchema.openapi('SetupCredentialsDto');
const setupTicketCredentialsInput = SetupTicketCredentialsSchema.openapi('SetupTicketCredentialsDto');
const setupTokenCredentialsInput = SetupTokenCredentialsSchema.openapi('SetupTokenCredentialsDto');
const capabilitiesResponse = AuthCapabilitiesSchema.openapi('AuthCapabilitiesDto_Output');
const setupStatusResponse = SetupStatusSchema.openapi('SetupStatusDto_Output');
const setupTicketResponse = SetupTicketSchema.openapi('SetupTicketDto_Output');
const setupValidationResponse = SetupValidationSchema.openapi('SetupValidationDto_Output');
const authSessionResponse = AuthSessionSchema.openapi('AuthSessionDto_Output');
const authUserResponse = AuthUserSchema.openapi('AuthUserDto_Output');
const capabilitiesRoute = createRoute({
  method: 'get',
  path: '/auth/capabilities',
  operationId: 'AuthController_capabilities',
  parameters: [],
  responses: {
    200: {
      description: 'Authentication capabilities supported by the server',
      content: { 'application/json': { schema: capabilitiesResponse } },
    },
  },
  tags: ['Auth'],
});
const setupStatusRoute = createRoute({
  method: 'get',
  path: '/auth/setup',
  operationId: 'AuthController_setupStatus',
  parameters: [],
  responses: {
    200: {
      description: 'Initial setup and registration status',
      content: { 'application/json': { schema: setupStatusResponse } },
    },
  },
  tags: ['Auth'],
});
const setupRoute = createRoute({
  method: 'post',
  path: '/auth/setup',
  operationId: 'AuthController_setup',
  middleware: [jsonBodyMiddleware] as const,
  parameters: [],
  request: {
    body: { required: true, content: { 'application/json': { schema: setupCredentialsInput } } },
  },
  responses: {
    201: {
      description: 'Administrator session created during initial setup',
      content: { 'application/json': { schema: authSessionResponse } },
    },
  },
  tags: ['Auth'],
});
const verifySetupRoute = createRoute({
  method: 'post',
  path: '/auth/setup/verify',
  operationId: 'AuthController_verifySetupToken',
  middleware: [jsonBodyMiddleware] as const,
  parameters: [],
  request: {
    body: { required: true, content: { 'application/json': { schema: setupTokenCredentialsInput } } },
  },
  responses: {
    201: {
      description: 'Short-lived initial setup ticket',
      content: { 'application/json': { schema: setupTicketResponse } },
    },
  },
  tags: ['Auth'],
});
const validateSetupRoute = createRoute({
  method: 'post',
  path: '/auth/setup/validate',
  operationId: 'AuthController_validateSetupTicket',
  middleware: [jsonBodyMiddleware] as const,
  parameters: [],
  request: {
    body: { required: true, content: { 'application/json': { schema: setupTicketCredentialsInput } } },
  },
  responses: {
    201: {
      description: 'Setup ticket validation result',
      content: { 'application/json': { schema: setupValidationResponse } },
    },
  },
  tags: ['Auth'],
});
const loginRoute = createRoute({
  method: 'post',
  path: '/auth/login',
  operationId: 'AuthController_login',
  middleware: [jsonBodyMiddleware] as const,
  parameters: [],
  request: {
    body: { required: true, content: { 'application/json': { schema: credentialsInput } } },
  },
  responses: {
    201: {
      description: 'Authenticated session',
      content: { 'application/json': { schema: authSessionResponse } },
    },
  },
  tags: ['Auth'],
});
const registerRoute = createRoute({
  method: 'post',
  path: '/auth/register',
  operationId: 'AuthController_register',
  middleware: [jsonBodyMiddleware] as const,
  parameters: [],
  request: {
    body: { required: true, content: { 'application/json': { schema: registrationCredentialsInput } } },
  },
  responses: {
    201: {
      description: 'Registered user session',
      content: { 'application/json': { schema: authSessionResponse } },
    },
  },
  tags: ['Auth'],
});
const meRoute = createRoute({
  method: 'get',
  path: '/auth/me',
  operationId: 'AuthController_me',
  parameters: [],
  responses: {
    200: {
      description: 'Current authenticated account',
      content: { 'application/json': { schema: authUserResponse } },
    },
  },
  tags: ['Auth'],
});
const ticketResponse = ActivityEventsTicketSchema.openapi('ActivityEventsTicketDto_Output');
const activityTicketRoute = createRoute({
  method: 'post',
  path: '/auth/activity-events-ticket',
  operationId: 'AuthController_activityEventsTicket',
  parameters: [],
  responses: {
    201: {
      description: 'Short-lived ticket for the activity event WebSocket',
      content: { 'application/json': { schema: ticketResponse } },
    },
  },
  tags: ['Auth'],
});
const jobTicketRoute = createRoute({
  method: 'post',
  path: '/auth/job-events-ticket',
  operationId: 'AuthController_jobEventsTicket',
  parameters: [],
  responses: {
    201: {
      description: 'Short-lived ticket for the job event WebSocket',
      content: { 'application/json': { schema: ticketResponse } },
    },
  },
  tags: ['Auth'],
});

export const registerAuthRoutes = (
  app: OpenAPIHono<ApiEnv>,
  service: AuthRouteService,
  users: ApiUserLookup,
  config: Pick<ConfigPort, 'registrationEnabled'>,
): void => {
  app.openapi(capabilitiesRoute, (context) => context.json({ direct: true }, 200) as never);
  app.openapi(setupStatusRoute, async (context) => {
    const status = await service.setupStatus();
    return context.json({ ...status, registrationEnabled: config.registrationEnabled }, 200) as never;
  });
  app.openapi(setupRoute, async (context) => {
    const value = context.req.valid('json');
    const result = await service.setup(
      value.email,
      value.firstName ?? '',
      value.lastName ?? '',
      value.password,
      value.setupTicket,
    );
    return context.json(result, 201) as never;
  });
  app.openapi(verifySetupRoute, async (context) => {
    const value = context.req.valid('json');
    const forwardedFor = context.req.header('X-Forwarded-For');
    const clientId = forwardedFor?.split(',', 1)[0]?.trim() || context.env.incoming?.socket?.remoteAddress || 'unknown';
    return context.json(await service.verifySetupToken(value.setupToken, clientId), 201) as never;
  });
  app.openapi(validateSetupRoute, async (context) => {
    const value = context.req.valid('json');
    return context.json(await service.validateSetupTicket(value.setupTicket), 201) as never;
  });
  app.openapi(loginRoute, async (context) => {
    const value = context.req.valid('json');
    return context.json(await service.login(value.email, value.password), 201) as never;
  });
  app.openapi(registerRoute, async (context) => {
    const value = context.req.valid('json');
    return context.json(
      await service.register(value.email, value.firstName, value.lastName, value.password),
      201,
    ) as never;
  });
  app.openapi(meRoute, async (context) => {
    const storedUser = await users.findById(context.get('user').id);
    if (!storedUser) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return context.json(
      {
        id: storedUser.id,
        email: storedUser.email,
        firstName: storedUser.first_name,
        lastName: storedUser.last_name,
        role: storedUser.role,
        avatarUrl: storedUser.avatar_path ? `/api/v1/users/${storedUser.id}/avatar` : null,
      },
      200,
    ) as never;
  });
  app.openapi(activityTicketRoute, (context) =>
    context.json(ticketResponse.parse(service.createActivityEventsTicket(context.get('user').id)), 201),
  );
  app.openapi(jobTicketRoute, (context) => {
    if (context.get('user').role !== 'admin') {
      throw new ForbiddenException('Administrator access is required');
    }
    return context.json(ticketResponse.parse(service.createJobEventsTicket(context.get('user').id)), 201);
  });
};
