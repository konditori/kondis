import { Body, Controller, Get, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedUser, CurrentUser, Public } from 'src/auth';
import { AuthService } from 'src/services/auth.service';
import { UserRepository } from 'src/repositories/user.repository';
const credentials = z.object({ email: z.string(), name: z.string().optional(), password: z.string() });
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly service: AuthService, private readonly users: UserRepository) {}
  @Public() @Get('setup') setupStatus() { return this.service.setupStatus(); }
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
  @Public() @Post('login') login(@Body() body: unknown) { const value = credentials.parse(body); return this.service.login(value.email, value.password); }
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const storedUser = await this.users.findById(user.id);
    if (!storedUser) throw new UnauthorizedException('Account no longer exists');
    return { id: storedUser.id, email: storedUser.email, name: storedUser.name, role: storedUser.role };
  }
}
