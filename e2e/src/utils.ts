/* eslint-disable unicorn/name-replacements, unicorn/no-top-level-side-effects */
import {
  activityControllerDeleteById,
  activityControllerListRecent,
  defaults,
  uploadControllerUploadActivity,
  type ActivityListResponseDtoOutput,
} from '@kondis/sdk';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const serverUrl = process.env.KONDIS_E2E_SERVER_URL;

if (!serverUrl) {
  throw new Error('KONDIS_E2E_SERVER_URL must be set');
}

export const testAssetDirectory = resolve(import.meta.dirname, '../../test/test-assets');
const setupTokenFile = resolve(import.meta.dirname, '../.setup-token');

export const utils = {
  init: async () => {
    defaults.baseUrl = serverUrl;

    const credentials = {
      email: 'e2e@example.com',
      firstName: 'E2E',
      lastName: 'User',
      password: 'e2e-test-password',
    };
    const setupTokenFileContents = await readFile(setupTokenFile, 'utf8');
    const setupToken = setupTokenFileContents.trim();
    const verified = await fetch(`${serverUrl}/auth/setup/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ setupToken }),
    });
    const setup = await fetch(`${serverUrl}/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...credentials,
        setupTicket: verified.ok ? ((await verified.json()) as { token: string }).token : '',
      }),
    });
    let result: { accessToken: string };
    if (setup.ok) {
      result = (await setup.json()) as { accessToken: string };
    } else {
      const login = await fetch(`${serverUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      result = (await login.json()) as { accessToken: string };
    }

    defaults.headers = { authorization: `Bearer ${result.accessToken}` };
  },

  cleanup: async () => {
    for (;;) {
      const { activities } = await activityControllerListRecent({});
      if (activities.length === 0) {
        return;
      }

      await Promise.all(activities.map(({ id }: { id: string }) => activityControllerDeleteById({ id })));
    }
  },

  createActivity: async (relativePath: string, contentType = 'application/octet-stream') => {
    const path = resolve(testAssetDirectory, relativePath);
    const bytes = await readFile(path);
    const file = new File([bytes], basename(path), { type: contentType });
    await uploadControllerUploadActivity({ body: { file } });

    return utils.waitForActivity();
  },

  waitForActivity: async (timeoutMs = 25_000): Promise<ActivityListResponseDtoOutput['activities'][number]> => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const { activities } = await activityControllerListRecent({});
      const activity = activities.at(0);
      if (activity?.metrics) {
        return activity;
      }

      await setTimeout(300);
    }

    throw new Error('Timed out waiting for the uploaded activity');
  },
};

await utils.init();
