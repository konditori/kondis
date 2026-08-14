import { Body, Controller, Get, Post } from '@nestjs/common';
import { AdminOnly } from 'src/auth';
import { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import { z } from 'zod';

const createUser = z.object({
  email: z.string(),
  name: z.string(),
  password: z.string(),
  role: z.enum(['user', 'admin']).default('user'),
});
@Controller('users')
@AdminOnly()
export class UserController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserRepository,
  ) {}
  @Get() async list() {
    const users = await this.users.all();
    return users.map(({ password_hash: _passwordHash, ...user }) => user);
  }
  @Post() async create(@Body() body: unknown) {
    const value = createUser.parse(body);
    const { password_hash: _passwordHash, ...user } = await this.auth.create(
      value.email,
      value.name,
      value.password,
      value.role,
    );
    return user;
  }
}
