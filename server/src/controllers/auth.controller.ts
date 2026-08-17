import { Body, Controller, Get, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { AuthenticatedUser, CurrentUser, Public } from 'src/auth';
import { ActivityEventsTicketDto } from 'src/dtos/auth.dto';
import { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import { z } from 'zod';
const credentials = z.object({ email: z.string(), name: z.string().optional(), password: z.string() });
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly service: AuthService,
    private readonly users: UserRepository,
  ) {}
  @Public() @Get('setup') setupStatus() {
    return this.service.setupStatus();
  }
  @Public() @Post('setup') setup(@Body() body: unknown) {
    try {
      const value = credentials.parse(body);
      return this.service.setup(value.email, value.name ?? '', value.password);
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
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const storedUser = await this.users.findById(user.id);
    if (!storedUser) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return {
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
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
