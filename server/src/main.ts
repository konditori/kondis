import type { Server } from 'node:http';

import { createNodeApiApp, createNodeServer } from 'src/api/node';
import { createApplicationComposition, type ApplicationComposition } from 'src/composition';
import { Logger } from 'src/logger';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';

export type ApiRuntime = {
  application: ApplicationComposition;
  server: Server;
  close: () => Promise<void>;
};

const listen = (server: Server, port: number, host: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });

const settleClose = async (operation: () => Promise<void>): Promise<PromiseSettledResult<void>> => {
  try {
    await operation();
    return { status: 'fulfilled', value: undefined };
  } catch (error) {
    return { status: 'rejected', reason: error };
  }
};

export const createApiRuntime = (application: ApplicationComposition, server: Server): ApiRuntime => {
  let closePromise: Promise<void> | undefined;
  return {
    application,
    server,
    close: () => {
      closePromise ??= (async () => {
        const serverClosing = settleClose(() => closeServer(server));
        const eventStopping = settleClose(() => application.eventRepository.stop());
        const serverResult = await serverClosing;
        const eventResult = await eventStopping;
        const applicationResult = await settleClose(() => application.close());
        const results = [serverResult, eventResult, applicationResult];
        const errors = results
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map(({ reason }) => reason);
        if (errors.length === 1) {
          throw errors[0];
        }
        if (errors.length > 1) {
          throw new AggregateError(errors, 'Failed to close API runtime');
        }
      })();
      return closePromise;
    },
  };
};

const installApiShutdown = (runtime: ApiRuntime, logger: Logger): void => {
  const shutdown = (signal: NodeJS.Signals) => {
    logger.log(`Received ${signal}; shutting down`);
    void runtime
      .close()
      .catch((error: unknown) => {
        logger.error('Graceful shutdown failed', error instanceof Error ? error.stack : String(error));
        process.exitCode = 1;
      })
      .finally(() => {
        if (process.connected && typeof process.disconnect === 'function') {
          process.disconnect();
        }
      });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

export async function bootstrapApi(): Promise<ApiRuntime> {
  const logger = new Logger('Bootstrap');
  const configRepository = new ConfigRepository();
  configRepository.logStartupSummary();

  await migrateDatabase(configRepository.database);

  const application = createApplicationComposition({ role: 'api', configRepository });
  const server = createNodeServer(createNodeApiApp(application));
  const runtime = createApiRuntime(application, server);

  try {
    await application.initialize();
    await application.authService.logSetupTokenIfRequired();
    await application.eventRepository.attach(server);
    await listen(server, configRepository.port, configRepository.listenAddress);
  } catch (error) {
    await runtime.close();
    throw error;
  }

  logger.log(`Kondis api listening on ${configRepository.listenAddress} on port ${configRepository.port}`);
  installApiShutdown(runtime, logger);
  return runtime;
}

export async function bootstrapWorker(): Promise<ApplicationComposition> {
  const logger = new Logger('Bootstrap');
  const application = createApplicationComposition({ role: 'worker' });
  application.configRepository.logStartupSummary();
  try {
    await application.initialize();
  } catch (error) {
    await application.close();
    throw error;
  }
  logger.log('Kondis background worker started');
  return application;
}
