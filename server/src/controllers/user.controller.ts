import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';

import { AdminOnly, AuthenticatedUser, CurrentUser } from 'src/auth';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import { UserService } from 'src/services/user.service';
import { UploadedFileData } from 'src/types/uploads';

const createUser = z.object({
  email: z.string(),
  name: z.string(),
  password: z.string(),
  role: z.enum(['user', 'admin']).default('user'),
});
@Controller('users')
@ApiTags('User')
export class UserController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserRepository,
    private readonly userService: UserService,
  ) {}

  @Get()
  @AdminOnly()
  async list() {
    const users = await this.users.all();
    return users.map(({ password_hash: _passwordHash, ...user }) => user);
  }
  @Post()
  @AdminOnly()
  async create(@Body() body: unknown) {
    const value = createUser.parse(body);
    const { password_hash: _passwordHash, ...user } = await this.auth.create(
      value.email,
      value.name,
      value.password,
      value.role,
    );
    return user;
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMITS.avatarFileBytes, files: 1 } }))
  uploadAvatar(@UploadedFile() file: UploadedFileData | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.userService.uploadAvatar(user.id, file);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAvatar(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.userService.clearAvatar(user.id);
  }

  @Get(':id/avatar')
  async avatarFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const avatar = await this.userService.avatarFile(id, user.id);
    if (!avatar.avatar_path || !avatar.avatar_mime_type || avatar.avatar_size === null) {
      throw new NotFoundException('Profile picture does not exist');
    }
    response.setHeader('Content-Type', avatar.avatar_mime_type);
    response.setHeader('Content-Length', String(avatar.avatar_size));
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.sendFile(this.userService.avatarAbsolutePath(avatar.avatar_path));
  }
}
