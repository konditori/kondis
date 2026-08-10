import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { FitUploadResponseDto, LagomTakeoutUploadResponseDto } from 'src/dtos/upload.dto';
import { UploadService } from 'src/services/upload.service';
import { UploadedFitFile } from 'src/types';

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
    description: 'Activity file stored; parsing is queued and happens asynchronously',
    type: FitUploadResponseDto,
  })
  @Post('uploads/activity')
  @UseInterceptors(FileInterceptor('file'))
  async uploadActivity(@UploadedFile() file?: UploadedFitFile): Promise<FitUploadResponseDto> {
    return this.service.uploadFit(file);
  }

  @ApiOperation({ summary: 'Import activities from a Lagom takeout ZIP archive' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Lagom takeout .zip file containing activities.csv and the activities folder',
        },
      },
    },
  })
  @ZodResponse({
    status: 201,
    description: 'Activity files stored; parsing is queued and happens asynchronously',
    type: LagomTakeoutUploadResponseDto,
  })
  @Post('uploads/lagom')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLagomTakeout(@UploadedFile() file?: UploadedFitFile): Promise<LagomTakeoutUploadResponseDto> {
    return this.service.uploadLagomTakeout(file);
  }
}
