import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { FitUploadResponseDto } from 'src/dtos/upload.dto';
import { UploadService } from 'src/services/upload.service';
import { UploadedFitFile } from 'src/types';

@ApiTags('imports')
@Controller()
export class ImportController {
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
}
