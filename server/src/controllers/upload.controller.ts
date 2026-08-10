import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { FitUploadResponseDto, LagomTakeoutUploadResponseDto } from 'src/dtos/upload.dto';
import { UploadService } from 'src/services/upload.service';
import { UploadedFileData } from 'src/types';

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
  @UseInterceptors(FileInterceptor('file'))
  async uploadActivity(@UploadedFile() file?: UploadedFileData): Promise<FitUploadResponseDto> {
    return this.service.uploadFit(file);
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadStravaTakeout(@UploadedFile() uploadedFile?: UploadedFileData): Promise<LagomTakeoutUploadResponseDto> {
    return this.service.uploadLagomTakeout(uploadedFile);
  }
}
