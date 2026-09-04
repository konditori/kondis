import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AdminOnly, AuthenticatedUser, CurrentUser } from 'src/auth';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import { UserService } from 'src/services/user.service';
import { BufferedUploadedFileData } from 'src/types/uploads';

const createUser = z.object({
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  password: z.string(),
  role: z.enum(['user', 'admin']).default('user'),
});
const updateName = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});
@Controller('users')
@ApiTags('User')
export class UserController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserRepository,
    private readonly userService: UserService,
  ) {}
  @Post()
  @AdminOnly()
  async create(@Body() body: unknown) {
    const value = createUser.parse(body);
    const { password_hash: _passwordHash, ...user } = await this.auth.create(
      value.email,
      value.firstName,
      value.lastName,
      value.password,
      value.role,
    );
    return user;
  }

  @Patch('me')
  async updateMe(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const value = updateName.parse(body);
    await this.users.setNameParts(user.id, value.firstName, value.lastName);
    const updated = await this.users.findById(user.id);
    if (!updated) {
      throw new NotFoundException('User does not exist');
    }
    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.first_name,
      lastName: updated.last_name,
      role: updated.role,
      avatarUrl: updated.avatar_path ? `/api/v1/users/${updated.id}/avatar` : null,
    };
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMITS.avatarFileBytes, files: 1 } }))
  uploadAvatar(@UploadedFile() file: BufferedUploadedFileData | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.userService.uploadAvatar(user.id, file);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAvatar(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.userService.clearAvatar(user.id);
  }
}
