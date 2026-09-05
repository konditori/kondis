import { fileURLToPath } from 'node:url';

import { createCloudNodeProcessorComposition } from 'src/composition.cloud-node';

export const bootstrapCloudNodeProcessor = async () => {
  if (process.env.KONDIS_CLOUD_NODE_PROCESSOR_ENABLED !== 'true') {
    throw new Error('KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true is required for the cloud Node processor');
  }

  const processor = createCloudNodeProcessorComposition();
  try {
    await processor.initialize();
  } catch (error) {
    await processor.close();
    throw error;
  }

  console.log('Kondis cloud Node processor started');
  let shutdown: Promise<void> | undefined;
  const stop = () => {
    shutdown ??= processor.close();
    void shutdown.catch((error: unknown) => {
      console.error('Cloud Node processor shutdown failed', error);
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return processor;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void bootstrapCloudNodeProcessor().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
