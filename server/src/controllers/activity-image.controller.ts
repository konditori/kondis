import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';

import { AuthenticatedUser, CurrentUser } from 'src/auth';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { ActivityImageDto, ActivityImageListDto, ActivityImageUpdateDto } from 'src/dtos/activity-image.dto';
import { ActivityImageService } from 'src/services/activity-image.service';
import { BufferedUploadedFileData } from 'src/types/uploads';

@ApiTags('activity-images')
@Controller()
export class ActivityImageController {
  constructor(private readonly service: ActivityImageService) {}

  @ApiOperation({ summary: 'Upload an image to an activity' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' }, caption: { type: 'string' } },
    },
  })
  @ZodResponse({ status: 201, description: 'Image processing was queued', type: ActivityImageDto })
  @Post('activities/:id/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMITS.imageFileBytes, files: 1, fields: 1 } }))
  upload(
    @Param('id') activityId: string,
    @UploadedFile() file: BufferedUploadedFileData | undefined,
    @Body('caption') caption: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upload(activityId, file, caption, user.id);
  }

  @ApiOperation({ summary: 'List ready images attached to an activity' })
  @ZodResponse({ status: 200, description: 'Activity images', type: ActivityImageListDto })
  @Get('activities/:id/images')
  list(@Param('id') activityId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(activityId, user.id);
  }

  @Patch('activities/:activityId/images/:imageId')
  @ZodResponse({ status: 200, description: 'Updated activity image', type: ActivityImageDto })
  update(
    @Param('activityId') activityId: string,
    @Param('imageId') imageId: string,
    @Body() input: ActivityImageUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(activityId, imageId, input, user.id);
  }

  @Delete('activities/:activityId/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('activityId') activityId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!(await this.service.delete(activityId, imageId, user.id))) {
      throw new NotFoundException('Image does not exist');
    }
  }

  @ApiOperation({ summary: 'Read an image variant' })
  @Get('activity-images/:imageId/:variant')
  async file(
    @Param('imageId') imageId: string,
    @Param('variant') variant: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    if (!['original', 'thumbnail', 'preview'].includes(variant)) {
      throw new NotFoundException('Image variant does not exist');
    }
        const file = await this.service.getFile(imageId, variant as 'original' | 'thumbnail' | 'preview', user.id);
        response.setHeader('Content-Type', file.mime_type);
        response.setHeader('Content-Length', String(file.byte_size));
        response.setHeader('Content-Disposition', 'inline');
        response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.sendFile(file.absolutePath);
  }
}
