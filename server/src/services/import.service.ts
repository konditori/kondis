import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';

import { FitUploadResponseDto } from 'src/dtos/fit-upload.dto';
import { UploadedFitFile } from 'src/types';

@Injectable()
export class ImportService {
  async uploadFit(file?: UploadedFitFile): Promise<FitUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.fit') {
      throw new BadRequestException('Only .fit files are accepted');
    }

    const uploadDir = process.env.KONDIS_UPLOAD_DIR ?? resolve(process.cwd(), 'uploads', 'fit');
    await mkdir(uploadDir, { recursive: true });

    const safeName = basename(file.originalname, extension).replaceAll(/[^a-zA-Z0-9._-]/g, '-');
    const storedFileName = `${Date.now()}-${safeName || randomUUID()}${extension}`;
    const outputPath = resolve(uploadDir, storedFileName);

    await writeFile(outputPath, file.buffer);

    return {
      fileName: storedFileName,
      byteSize: file.size,
      path: outputPath,
    };
  }
}
