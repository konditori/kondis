import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from 'src/config/config.service';
import { UserRepository } from 'src/repositories/user.repository';

export type AuthenticatedUser = {
  id: string;
  role: 'admin' | 'user';
  email: string;
  firstName: string;
  lastName: string;
};
type EventTicket = { id: string; scope: 'activity-events'; exp: number };
export const PUBLIC = 'kondis:public';
export const Public = () => SetMetadata(PUBLIC, true);
export const ADMIN = 'kondis:admin';
export const AdminOnly = () => SetMetadata(ADMIN, true);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');
const hasValidSignature = (payload: string, signature: string, secret: string): boolean => {
  const expected = sign(payload, secret);
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};
export const createAccessToken = (user: AuthenticatedUser, secret: string) => {
  const payload = encode({ ...user, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 });
  return `${payload}.${sign(payload, secret)}`;
};

/** A deliberately short-lived, single-purpose credential for the browser WebSocket handshake. */
export const createActivityEventsTicket = (userId: string, secret: string) => {
  const expiresAt = new Date(Date.now() + 60_000);
  const payload = encode({ id: userId, scope: 'activity-events', exp: Math.floor(expiresAt.getTime() / 1000) });
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt: expiresAt.toISOString() };
};

export const verifyActivityEventsTicket = (token: string | null, secret: string): string | undefined => {
  if (!token) {
    return undefined;
  }
  const [payload, signature] = token.split('.', 2);
  if (!payload || !signature || !hasValidSignature(payload, signature, secret)) {
    return undefined;
  }
  try {
    const ticket = JSON.parse(Buffer.from(payload, 'base64url').toString()) as EventTicket;
    if (ticket.scope !== 'activity-events' || !ticket.id || ticket.exp * 1000 < Date.now()) {
      return undefined;
    }
    return ticket.id;
  } catch {
    return undefined;
  }
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UserRepository,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler() as object;
    const controller = context.getClass() as object;
    // reflect-metadata augments the standard Reflect object at runtime.
    // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties
    if (Reflect.getMetadata(PUBLIC, handler) || Reflect.getMetadata(PUBLIC, controller)) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthenticatedUser }>();
    // Native clients behind a perimeter gateway (e.g. Cloudflare Access Managed OAuth) occupy the
    // standard `Authorization` header with a perimeter access token. They send the Kondis session
    // token separately in this dedicated header so the two credentials never collide. Existing
    // `Authorization: Bearer` clients (older Android builds, scripts) keep working unchanged.
    const kondisHeader = request.headers['x-kondis-authorization'];
    const kondisHeaderToken = kondisHeader?.startsWith('Bearer ') ? kondisHeader.slice(7) : undefined;
    const value = request.headers.authorization;
    const bearerToken = value?.startsWith('Bearer ') ? value.slice(7) : undefined;
    const cookieToken = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('kondis_session='))
      ?.slice('kondis_session='.length);
    const token = kondisHeaderToken ?? bearerToken ?? cookieToken;
    if (!token) {
      throw new UnauthorizedException('Sign in is required');
    }
    const [payload, signature] = token.split('.', 2);
    if (!payload || !signature) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (!hasValidSignature(payload, signature, this.config.authSecret)) {
      throw new UnauthorizedException('Invalid access token');
    }
    let parsed: AuthenticatedUser & { exp: number };
    try {
      parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AuthenticatedUser & { exp: number };
      if (!parsed.id || !parsed.email || !['admin', 'user'].includes(parsed.role) || parsed.exp * 1000 < Date.now()) {
        throw new Error('Invalid access token');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    const stored = await this.users.findById(parsed.id);
    if (!stored) {
      throw new UnauthorizedException('Account no longer exists');
    }
    request.user = {
      id: stored.id,
      email: stored.email,
      role: stored.role,
      firstName: stored.first_name,
      lastName: stored.last_name,
    };
    // reflect-metadata augments the standard Reflect object at runtime.
    /* eslint-disable unicorn/no-nonstandard-builtin-properties */
    if (
      (Reflect.getMetadata(ADMIN, handler) || Reflect.getMetadata(ADMIN, controller)) &&
      request.user.role !== 'admin'
    ) {
      throw new ForbiddenException('Administrator access is required');
    }
    /* eslint-enable unicorn/no-nonstandard-builtin-properties */
    return true;
  }
}
