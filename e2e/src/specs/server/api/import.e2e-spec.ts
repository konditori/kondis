import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { importControllerUploadFit } from '@kondis/sdk';

const fixturePath = resolve(process.cwd(), 'test-assets', 'activities', 'running', '2015-hindas', '2015-06-22-run.fit');

describe('POST /uploads/fit', () => {
  let fileBuffer: Buffer;

  beforeAll(async () => {
    fileBuffer = await readFile(fixturePath);
  });

  const upload = () =>
    importControllerUploadFit({
      body: {
        file: new File([fileBuffer], '2015-06-22-run.fit', { type: 'application/octet-stream' }),
      },
    });

  it('stores a .fit file and deduplicates identical content', async () => {
    const first = await upload();

    expect(first.id).toBeTruthy();
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(first.byteSize).toBe(fileBuffer.length);

    // Content-addressed storage means re-uploading the same bytes is a no-op that resolves to
    // the same upload rather than creating a second one. Asserting it this way also keeps the
    // test correct under vitest's CI retries, where the first upload may already exist.
    const second = await upload();

    expect(second.id).toBe(first.id);
    expect(second.checksum).toBe(first.checksum);
    expect(second.duplicate).toBe(true);
  });
});
