import { Body, Controller, Get, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedUser, CurrentUser, Public } from 'src/auth';
import { AuthService } from 'src/services/auth.service';
const credentials = z.object({ email: z.string(), name: z.string().optional(), password: z.string() });
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Public() @Get('setup') setupStatus() { return this.service.setupStatus(); }
  @Public() @Post('setup') setup(@Body() body: unknown) { const value = credentials.parse(body); return this.service.setup(value.email, value.name ?? '', value.password); }
  @Public() @Post('login') login(@Body() body: unknown) { const value = credentials.parse(body); return this.service.login(value.email, value.password); }
  @Get('me') me(@CurrentUser() user: AuthenticatedUser) { return user; }
}
