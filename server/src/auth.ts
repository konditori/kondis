import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from 'src/config/config.service';

export type AuthenticatedUser = { id: string; role: 'admin' | 'user'; email: string; name: string };
export const PUBLIC = 'kondis:public';
export const Public = () => SetMetadata(PUBLIC, true);
export const ADMIN = 'kondis:admin';
export const AdminOnly = () => SetMetadata(ADMIN, true);
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser =>
  context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');
export const createAccessToken = (user: AuthenticatedUser, secret: string) => {
  const payload = encode({ ...user, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 });
  return `${payload}.${sign(payload, secret)}`;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler() as object;
    const controller = context.getClass() as object;
    if (Reflect.getMetadata(PUBLIC, handler) || Reflect.getMetadata(PUBLIC, controller)) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthenticatedUser }>();
    const value = request.headers.authorization;
    const token = value?.startsWith('Bearer ') ? value.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Sign in is required');
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new UnauthorizedException('Invalid access token');
    const expected = sign(payload, this.config.authSecret);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid access token');
    }
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AuthenticatedUser & { exp: number };
      if (!parsed.id || !parsed.email || !['admin', 'user'].includes(parsed.role) || parsed.exp * 1000 < Date.now()) throw new Error();
      request.user = { id: parsed.id, email: parsed.email, role: parsed.role, name: parsed.name };
      if (Reflect.getMetadata(ADMIN, handler) || Reflect.getMetadata(ADMIN, controller)) {
        if (request.user.role !== 'admin') throw new ForbiddenException('Administrator access is required');
      }
      return true;
    } catch { throw new UnauthorizedException('Invalid or expired access token'); }
  }
}
