import { describe, expect, it, vi } from 'vitest';

import { createApiApp, createOpenApiDocument } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

const ACTIVITY_ID = '00000000-0000-4000-8000-000000000002';
const IMAGE_ID = '00000000-0000-4000-8000-000000000003';
const image = {
  id: IMAGE_ID,
  caption: 'Finish line',
  sortOrder: 0,
  width: 1200,
  height: 800,
  status: 'ready' as const,
  thumbnail: `/api/v1/activity-images/${IMAGE_ID}/thumbnail`,
  preview: `/api/v1/activity-images/${IMAGE_ID}/preview`,
  original: `/api/v1/activity-images/${IMAGE_ID}/original`,
};

describe('API activity image routes', () => {
  it('delegates authenticated image upload, list, update, and delete requests', async () => {
    const file = { originalname: 'finish.jpg', size: 3, buffer: Buffer.from('img') };
    const read = vi.fn(() => Promise.resolve({ file, caption: 'Finish line' }));
    const upload = vi.fn(() => Promise.resolve(image));
    const list = vi.fn(() => Promise.resolve([image]));
    const update = vi.fn(() => Promise.resolve({ ...image, caption: null, sortOrder: 1 }));
    const deleteImage = vi.fn(() => Promise.resolve(true));
    const app = createApiApp(
      newApiDependencies({
        activityImages: { delete: deleteImage, list, update, upload },
        uploads: { read },
        users: newApiUsers(),
      }),
    );

    const uploaded = await app.request(`/activities/${ACTIVITY_ID}/images`, {
      method: 'POST',
      headers: apiAuthHeaders(),
    });
    expect(uploaded.status).toBe(201);
    expect(upload).toHaveBeenCalledWith(ACTIVITY_ID, file, 'Finish line', TEST_API_USER.id);

    const listed = await app.request(`/activities/${ACTIVITY_ID}/images`, { headers: apiAuthHeaders() });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([image]);
    expect(list).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id);

    const updated = await app.request(`/activities/${ACTIVITY_ID}/images/${IMAGE_ID}`, {
      method: 'PATCH',
      headers: { ...apiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: null, sortOrder: 1 }),
    });
    expect(updated.status).toBe(200);
    expect(update).toHaveBeenCalledWith(ACTIVITY_ID, IMAGE_ID, { caption: null, sortOrder: 1 }, TEST_API_USER.id);

    const deleted = await app.request(`/activities/${ACTIVITY_ID}/images/${IMAGE_ID}`, {
      method: 'DELETE',
      headers: apiAuthHeaders(),
    });
    expect(deleted.status).toBe(204);
    expect(deleteImage).toHaveBeenCalledWith(ACTIVITY_ID, IMAGE_ID, TEST_API_USER.id);
  });

  it('returns 404 when an image cannot be deleted', async () => {
    const deleteImage = vi.fn(() => Promise.resolve(false));
    const response = await createApiApp(
      newApiDependencies({ activityImages: { delete: deleteImage }, users: newApiUsers() }),
    ).request(`/activities/${ACTIVITY_ID}/images/${IMAGE_ID}`, {
      method: 'DELETE',
      headers: apiAuthHeaders(),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ message: 'Image does not exist' });
  });

  it('streams image files with native headers and does not open them for HEAD', async () => {
    const getFile = vi.fn(
      () =>
        Promise.resolve({
          absolutePath: '/images/finish.jpg',
          mime_type: 'image/jpeg',
          byte_size: 3,
        }) as never,
    );
    const read = vi.fn(() => Promise.resolve(new Uint8Array(Buffer.from('img'))));
    const app = createApiApp(
      newApiDependencies({ activityImages: { getFile }, files: { read }, users: newApiUsers() }),
    );
    const path = `/activity-images/${IMAGE_ID}/original`;

    const response = await app.request(path, { headers: apiAuthHeaders() });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('img');
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Content-Length')).toBe('3');
    expect(response.headers.get('Content-Disposition')).toBe('inline');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(getFile).toHaveBeenCalledWith(IMAGE_ID, 'original', TEST_API_USER.id);
    expect(read).toHaveBeenCalledWith('/images/finish.jpg');

    read.mockClear();
    const head = await app.request(path, { method: 'HEAD', headers: apiAuthHeaders() });
    expect(head.status).toBe(200);
    expect(read).not.toHaveBeenCalled();
  });

  it('returns 404 for an invalid variant without delegating to the service', async () => {
    const getFile = vi.fn();
    const response = await createApiApp(
      newApiDependencies({ activityImages: { getFile }, users: newApiUsers() }),
    ).request(`/activity-images/${IMAGE_ID}/large`, { headers: apiAuthHeaders() });

    expect(response.status).toBe(404);
    expect(getFile).not.toHaveBeenCalled();
  });

  it('preserves activity image operation ids and schema references', () => {
    const document = createOpenApiDocument(createApiApp(newApiDependencies()));

    expect(document.paths['/activities/{id}/images']?.post).toMatchObject({
      operationId: 'ActivityImageController_upload',
      responses: {
        201: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityImageDto_Output' } } },
        },
      },
      summary: 'Upload an image to an activity',
      tags: ['activity-images'],
    });
    expect(document.paths['/activities/{id}/images']?.get).toMatchObject({
      operationId: 'ActivityImageController_list',
      responses: {
        200: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityImageListDto_Output' } } },
        },
      },
    });
    expect(document.paths['/activities/{activityId}/images/{imageId}']?.patch).toMatchObject({
      operationId: 'ActivityImageController_update',
      requestBody: {
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityImageUpdateDto' } } },
      },
    });
    expect(document.paths['/activities/{activityId}/images/{imageId}']?.delete).toMatchObject({
      operationId: 'ActivityImageController_delete',
      responses: { 204: { description: '' } },
    });
    expect(document.paths['/activity-images/{imageId}/{variant}']?.get).toMatchObject({
      operationId: 'ActivityImageController_file',
      summary: 'Read an image variant',
    });
  });
});
