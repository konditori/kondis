import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_PREFIX, createApiApp, type ApiDependencies } from 'src/api/app';
import { createNodeServer, nodeFileReader, nodeUploadReader } from 'src/api/node';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

describe(createNodeServer.name, () => {
  const servers: Server[] = [];
  const temporaryDirectories: string[] = [];

  const startApp = async (dependencies: ApiDependencies): Promise<string> => {
    const server = createNodeServer(createApiApp(dependencies));
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  };

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => closeServer(server)));
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it('serves the API under its prefix with trailing slash and HEAD support', async () => {
    const ping = vi.fn(() => ({ status: 'api' }));
    const baseUrl = await startApp(newApiDependencies({ server: { ping } }));

    const pingResponse = await fetch(`${baseUrl}${API_PREFIX}/ping`);
    expect(await pingResponse.json()).toEqual({ status: 'api' });
    expect(ping).toHaveBeenCalledOnce();

    const trailingSlashResponse = await fetch(`${baseUrl}${API_PREFIX}/ping/`);
    expect(await trailingSlashResponse.json()).toEqual({ status: 'api' });

    const headResponse = await fetch(`${baseUrl}${API_PREFIX}/ping`, { method: 'HEAD' });
    expect(headResponse.status).toBe(200);
    expect(await headResponse.text()).toBe('');

    const unprefixedResponse = await fetch(`${baseUrl}/ping`);
    const missingResponse = await fetch(`${baseUrl}${API_PREFIX}/missing`);
    expect(unprefixedResponse.status).toBe(404);
    expect(missingResponse.status).toBe(404);
  });

  it('dispatches parameterized routes directly to the API', async () => {
    const activityId = '00000000-0000-4000-8000-000000000002';
    const getById = vi.fn(() => Promise.resolve(void 0));
    const updateById = vi.fn(() => Promise.resolve(void 0));
    const baseUrl = await startApp(newApiDependencies({ activities: { getById, updateById }, users: newApiUsers() }));

    const response = await fetch(`${baseUrl}${API_PREFIX}/activities/${activityId}`, {
      headers: apiAuthHeaders(),
    });

    expect(response.status).toBe(404);
    expect(getById).toHaveBeenCalledWith(activityId, TEST_API_USER.id);

    const writeResponse = await fetch(`${baseUrl}${API_PREFIX}/activities/${activityId}`, {
      method: 'PUT',
      headers: { ...apiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'API write' }),
    });
    expect(writeResponse.status).toBe(404);
    expect(updateById).toHaveBeenCalledWith(activityId, TEST_API_USER.id, {
      name: 'API write',
      startedAt: undefined,
      excludeFromRankings: undefined,
      tags: undefined,
    });
  });

  it('streams Node multipart activity uploads to a temporary file', async () => {
    const uploadActivity = vi.fn(async (file: { originalname: string; path: string; size: number } | undefined) => {
      expect(file).toMatchObject({ originalname: 'run.fit', size: 9 });
      expect(await readFile(file!.path, 'utf8')).toBe('fit bytes');
      await rm(file!.path, { force: true });
      return { byteSize: file!.size, queued: true as const };
    });
    const baseUrl = await startApp(
      newApiDependencies({
        uploads: nodeUploadReader,
        uploadService: { uploadActivity },
        users: newApiUsers(),
      }),
    );
    const form = new FormData();
    form.append('file', new Blob(['fit bytes']), 'run.fit');

    const response = await fetch(`${baseUrl}${API_PREFIX}/upload/activity`, {
      method: 'POST',
      headers: apiAuthHeaders(),
      body: form,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ byteSize: 9, queued: true });
    expect(uploadActivity).toHaveBeenCalledOnce();
  });

  it('rejects extra avatar form fields before buffering the file', async () => {
    const uploadAvatar = vi.fn();
    const baseUrl = await startApp(
      newApiDependencies({
        uploads: nodeUploadReader,
        userService: { uploadAvatar },
        users: newApiUsers(),
      }),
    );
    const form = new FormData();
    form.append('metadata', 'unexpected');
    form.append('file', new Blob(['avatar']), 'avatar.png');

    const response = await fetch(`${baseUrl}${API_PREFIX}/users/me/avatar`, {
      method: 'POST',
      headers: apiAuthHeaders(),
      body: form,
    });

    expect(response.status).toBe(400);
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('buffers one activity image and reads its optional caption', async () => {
    const imageId = '00000000-0000-4000-8000-000000000003';
    const upload = vi.fn(
      (
        _activityId: string,
        file: { originalname: string; size: number; buffer: Buffer } | undefined,
        caption: string | undefined,
      ) => {
        expect(file).toMatchObject({ originalname: 'finish.jpg', size: 11 });
        expect(file?.buffer.toString()).toBe('image bytes');
        expect(file).not.toHaveProperty('path');
        expect(caption).toBe('Finish line');
        return Promise.resolve({
          id: imageId,
          caption: caption ?? null,
          sortOrder: 0,
          width: null,
          height: null,
          status: 'pending' as const,
          thumbnail: null,
          preview: null,
          original: null,
        });
      },
    );
    const baseUrl = await startApp(
      newApiDependencies({ activityImages: { upload }, uploads: nodeUploadReader, users: newApiUsers() }),
    );
    const form = new FormData();
    form.append('caption', 'Finish line');
    form.append('file', new Blob(['image bytes']), 'finish.jpg');

    const response = await fetch(`${baseUrl}${API_PREFIX}/activities/activity-id/images`, {
      method: 'POST',
      headers: apiAuthHeaders(),
      body: form,
    });

    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledWith(
      'activity-id',
      expect.objectContaining({ originalname: 'finish.jpg', size: 11 }),
      'Finish line',
      TEST_API_USER.id,
    );
  });

  it('streams files from native Node file handles', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kondis-node-file-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'original.jpg');
    await writeFile(path, 'image bytes');
    const getFile = vi.fn(
      () => Promise.resolve({ absolutePath: path, mime_type: 'image/jpeg', byte_size: 11 }) as never,
    );
    const baseUrl = await startApp(
      newApiDependencies({
        activityImages: { getFile },
        files: nodeFileReader,
        users: newApiUsers(),
      }),
    );

    const response = await fetch(`${baseUrl}${API_PREFIX}/activity-images/image-id/original`, {
      headers: apiAuthHeaders(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Content-Length')).toBe('11');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Last-Modified')).not.toBeNull();
    expect(await response.text()).toBe('image bytes');
    expect(getFile).toHaveBeenCalledWith('image-id', 'original', TEST_API_USER.id);

    const rangeResponse = await fetch(`${baseUrl}${API_PREFIX}/activity-images/image-id/original`, {
      headers: { ...apiAuthHeaders(), Range: 'bytes=6-' },
    });
    expect(rangeResponse.status).toBe(206);
    expect(rangeResponse.headers.get('Content-Range')).toBe('bytes 6-10/11');
    expect(rangeResponse.headers.get('Content-Length')).toBe('5');
    expect(await rangeResponse.text()).toBe('bytes');

    const conditionalResponse = await fetch(`${baseUrl}${API_PREFIX}/activity-images/image-id/original`, {
      headers: { ...apiAuthHeaders(), 'If-Modified-Since': response.headers.get('Last-Modified')! },
    });
    expect(conditionalResponse.status).toBe(304);
    expect(await conditionalResponse.text()).toBe('');

    const headResponse = await fetch(`${baseUrl}${API_PREFIX}/activity-images/image-id/original`, {
      method: 'HEAD',
      headers: apiAuthHeaders(),
    });
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get('Content-Length')).toBe('11');
    expect(await headResponse.text()).toBe('');

    await rm(path);
    const missingGet = await fetch(`${baseUrl}${API_PREFIX}/activity-images/image-id/original`, {
      headers: apiAuthHeaders(),
    });
    const missingHead = await fetch(`${baseUrl}${API_PREFIX}/activity-images/image-id/original`, {
      method: 'HEAD',
      headers: apiAuthHeaders(),
    });
    expect(missingGet.status).toBe(404);
    expect(await missingGet.json()).toMatchObject({ message: 'Image variant does not exist' });
    expect(missingHead.status).toBe(404);
    expect(await missingHead.text()).toBe('');
  });
});
