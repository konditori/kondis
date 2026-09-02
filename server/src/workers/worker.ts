import 'reflect-metadata';

import { isMainThread } from 'node:worker_threads';

import { bootstrapWorker } from 'src/main';

if (!isMainThread) {
  void bootstrapWorker().catch((error: unknown) => {
    console.error(error);
    throw error;
  });
}
