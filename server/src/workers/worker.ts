import { isMainThread, parentPort } from 'node:worker_threads';

import { bootstrapWorker } from 'src/main';

if (!isMainThread) {
  const port = parentPort;
  const runtime = bootstrapWorker();
  let shutdown: Promise<void> | undefined;

  port?.on('message', (message: unknown) => {
    if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'shutdown') {
      return;
    }
    shutdown ??= runtime.then((application) => application.close());
    void shutdown
      .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
      })
      .finally(() => port.close());
  });

  void runtime.catch((error: unknown) => {
    console.error(error);
    throw error;
  });
}
