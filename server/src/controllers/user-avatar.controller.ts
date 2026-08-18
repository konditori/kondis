import {
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

import { AuthenticatedUser, CurrentUser } from 'src/auth';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { UserAvatarService } from 'src/services/user-avatar.service';
import { UploadedFileData } from 'src/types/uploads';

@ApiTags('user avatars')
@Controller('users')
export class UserAvatarController {
  constructor(private readonly service: UserAvatarService) {}

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMITS.avatarFileBytes, files: 1 } }))
  upload(@UploadedFile() file: UploadedFileData | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.service.upload(user.id, file);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.clear(user.id);
  }

  @Get(':id/avatar')
  async file(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const avatar = await this.service.file(id, user.id);
    if (!avatar.avatar_path || !avatar.avatar_mime_type || avatar.avatar_size === null) {
      throw new NotFoundException('Profile picture does not exist');
    }
    response.setHeader('Content-Type', avatar.avatar_mime_type);
    response.setHeader('Content-Length', String(avatar.avatar_size));
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.sendFile(this.service.absolutePath(avatar.avatar_path));
  }
}
