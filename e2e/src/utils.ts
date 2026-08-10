/* eslint-disable unicorn/name-replacements, unicorn/no-top-level-side-effects */
import {
  activityControllerDeleteById,
  activityControllerListRecent,
  defaults,
  uploadControllerUploadActivity,
  type ActivityDtoOutput,
} from '@kondis/sdk';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const serverUrl = process.env.KONDIS_E2E_SERVER_URL;

if (!serverUrl) {
  throw new Error('KONDIS_E2E_SERVER_URL must be set');
}

export const testAssetDirectory = resolve(import.meta.dirname, '../../test/test-assets');

export const utils = {
  init: () => {
    defaults.baseUrl = serverUrl;
  },

  cleanup: async () => {
    for (;;) {
      const { activities } = await activityControllerListRecent({});
      if (activities.length === 0) {
        return;
      }

      await Promise.all(activities.map(({ id }) => activityControllerDeleteById({ id })));
    }
  },

  createActivity: async (relativePath: string, contentType = 'application/octet-stream') => {
    const path = resolve(testAssetDirectory, relativePath);
    const bytes = await readFile(path);
    const file = new File([bytes], basename(path), { type: contentType });
    await uploadControllerUploadActivity({ body: { file } });

    return utils.waitForActivity();
  },

  waitForActivity: async (timeoutMs = 25_000): Promise<ActivityDtoOutput> => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const { activities } = await activityControllerListRecent({});
      const activity = activities.at(0);
      if (activity) {
        return activity;
      }

      await setTimeout(300);
    }

    throw new Error('Timed out waiting for the uploaded activity');
  },
};

utils.init();
