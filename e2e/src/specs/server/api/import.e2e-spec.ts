import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { importControllerUploadFit } from '@kondis/sdk';

const fixturePath = resolve(process.cwd(), 'test-assets', 'activities', 'running', '2015-hindas', '2015-06-22-run.fit');

describe('POST /uploads/fit', () => {
  it('uploads a .fit file and stores it locally', async () => {
    const fileBuffer = await readFile(fixturePath);
    const uploadFile = new File([fileBuffer], '2015-06-22-run.fit', { type: 'application/octet-stream' });
    const response = await importControllerUploadFit({
      body: {
        file: uploadFile,
      },
    });

    expect(response.fileName.endsWith('.fit')).toBe(true);
    expect(response.byteSize).toBe(fileBuffer.length);
    expect(response.path).toContain('/uploads/fit/');
  });
});
