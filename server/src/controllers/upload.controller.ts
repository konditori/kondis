import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { FitUploadResponseDto, LagomTakeoutUploadResponseDto } from 'src/dtos/upload.dto';
import { UploadService } from 'src/services/upload.service';
import { UploadedFileData } from 'src/types';
import { AuthenticatedUser, CurrentUser } from 'src/auth';

@ApiTags('uploads')
@Controller()
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @ApiOperation({ summary: 'Upload a FIT, TCX, or GPX activity file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '.fit, .tcx, or .gpx activity file',
        },
      },
    },
  })
  @ZodResponse({
    status: 201,
    description: 'Activity file processing is queued and happens asynchronously',
    type: FitUploadResponseDto,
  })
  @Post('upload/activity')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: UPLOAD_LIMITS.activityFileBytes, files: 1, fields: 0 },
    }),
  )
  async uploadActivity(@UploadedFile() file: UploadedFileData | undefined, @CurrentUser() user: AuthenticatedUser): Promise<FitUploadResponseDto> {
    return this.service.uploadActivity(file, user.id);
  }

  @ApiOperation({ summary: 'Import activities from a Strava takeout ZIP archive' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Strava takeout .zip file',
        },
      },
    },
  })
  @ZodResponse({
    status: 201,
    description: 'Takeout importing and activity parsing are queued and happen asynchronously',
    type: LagomTakeoutUploadResponseDto,
  })
  @Post('upload/strava')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: UPLOAD_LIMITS.takeoutFileBytes, files: 1, fields: 0 },
    }),
  )
  async uploadStravaTakeout(@UploadedFile() uploadedFile: UploadedFileData | undefined, @CurrentUser() user: AuthenticatedUser): Promise<LagomTakeoutUploadResponseDto> {
    return this.service.uploadLagomTakeout(uploadedFile, user.id);
  }
}
