import assert from 'node:assert/strict';
import test from 'node:test';

import { activityImageControllerFile, defaults } from '../build/index.js';

test('accepts partial content responses', async () => {
  const previousBaseUrl = defaults.baseUrl;
  const previousFetch = defaults.fetch;
  defaults.baseUrl = 'http://localhost/api/v1';
  defaults.fetch = () => Promise.resolve(new Response(new Blob(['image bytes']), { status: 206 }));

  try {
    const result = await activityImageControllerFile({ imageId: 'image-id', variant: 'original' });
    assert.equal(await result.text(), 'image bytes');
  } finally {
    defaults.baseUrl = previousBaseUrl;
    defaults.fetch = previousFetch;
  }
});
