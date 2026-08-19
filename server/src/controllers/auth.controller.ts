import { Body, Controller, Get, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { AuthenticatedUser, CurrentUser, Public } from 'src/auth';
import { ActivityEventsTicketDto } from 'src/dtos/auth.dto';
import { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import { z } from 'zod';
const credentials = z.object({
  email: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string(),
});
const setupCredentials = credentials.extend({ setupToken: z.string().min(1) });
const registrationCredentials = z.object({
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  password: z.string(),
});
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly service: AuthService,
    private readonly users: UserRepository,
  ) {}
  /**
   * Lets native clients probe how to authenticate before sending credentials. A perimeter
   * gateway (for example Cloudflare Access) intercepts this request before it reaches Kondis
   * whenever one is configured, replying with its own `401`/`302` instead of this `200`. Clients
   * that see this response directly know the deployment has no such gateway and can sign in with
   * a Kondis email and password immediately.
   */
  @Public() @Get('capabilities') capabilities() {
    return { direct: true };
  }
  @Public() @Get('setup') setupStatus() {
    return this.service.setupStatus().then((status) => ({
      ...status,
      registrationEnabled: this.service.registrationEnabled,
    }));
  }
  @Public() @Post('setup') setup(@Body() body: unknown) {
    try {
      const value = setupCredentials.parse(body);
      return this.service.setup(
        value.email,
        value.firstName ?? '',
        value.lastName ?? '',
        value.password,
        value.setupToken,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Initial setup request rejected: ${message}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
  @Public() @Post('login') login(@Body() body: unknown) {
    const value = credentials.parse(body);
    return this.service.login(value.email, value.password);
  }
  @Public() @Post('register') register(@Body() body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const email = typeof payload.email === 'string' ? payload.email : '<missing>';
    const firstNameLength = typeof payload.firstName === 'string' ? payload.firstName.trim().length : 0;
    const lastNameLength = typeof payload.lastName === 'string' ? payload.lastName.trim().length : 0;
    const passwordLength = typeof payload.password === 'string' ? payload.password.length : 0;
    this.logger.log(
      `Public registration request received for ${email}; firstNameLength=${firstNameLength}, lastNameLength=${lastNameLength}, passwordLength=${passwordLength}`,
    );
    try {
      const value = registrationCredentials.parse(body);
      return this.service.register(value.email, value.firstName, value.lastName, value.password);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Public registration rejected for ${email}: ${message}`);
      throw error;
    }
  }
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const storedUser = await this.users.findById(user.id);
    if (!storedUser) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return {
      id: storedUser.id,
      email: storedUser.email,
      firstName: storedUser.first_name,
      lastName: storedUser.last_name,
      role: storedUser.role,
      avatarUrl: storedUser.avatar_path ? `/api/v1/users/${storedUser.id}/avatar` : null,
    };
  }
  @Post('activity-events-ticket')
  @ZodResponse({
    status: 201,
    description: 'Short-lived ticket for the activity event WebSocket',
    type: ActivityEventsTicketDto,
  })
  activityEventsTicket(@CurrentUser() user: AuthenticatedUser): ActivityEventsTicketDto {
    return this.service.createActivityEventsTicket(user.id);
  }
}
