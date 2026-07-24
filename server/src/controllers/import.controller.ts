import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { FitUploadResponseDto } from 'src/dtos/fit-upload.dto';
import { ImportService } from 'src/services/import.service';

type UploadedFitFile = {
  originalname: string;
  buffer: Buffer;
  size: number;
};

@ApiTags('imports')
@Controller()
export class ImportController {
  constructor(private readonly service: ImportService) {}

  @ApiOperation({ summary: 'Upload a FIT activity file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '.fit activity file',
        },
      },
    },
  })
  @ZodResponse({
    status: 201,
    description: 'FIT file uploaded and stored locally',
    type: FitUploadResponseDto,
  })
  @Post('uploads/fit')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFit(@UploadedFile() file?: UploadedFitFile): Promise<FitUploadResponseDto> {
    return this.service.uploadFit(file);
  }
}
