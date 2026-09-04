import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApplicationComposition } from 'src/composition';
import { ConfigRepository } from 'src/repositories/config.repository';
import { JobRepository } from 'src/repositories/job.repository';

describe(createApplicationComposition.name, () => {
  beforeEach(() => {
    vi.stubEnv('KONDIS_DB_USERNAME', 'composition');
    vi.stubEnv('KONDIS_DB_PASSWORD', 'composition');
    vi.stubEnv('KONDIS_DB_DATABASE_NAME', 'composition');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('exposes one named graph and only initializes job consumers for workers', async () => {
    const startWorkers = vi.spyOn(JobRepository.prototype, 'startWorkers').mockResolvedValue();
    const api = createApplicationComposition({ role: 'api' });
    const worker = createApplicationComposition({ role: 'worker' });

    expect(api.get(ConfigRepository)).toBe(api.configRepository);
    expect(api.get(JobRepository)).toBe(api.jobRepository);
    expect(api.database).not.toBe(worker.database);
    expect(api.jobRepository).not.toBe(worker.jobRepository);

    await api.initialize();
    expect(startWorkers).not.toHaveBeenCalled();
    await worker.initialize();
    expect(startWorkers).toHaveBeenCalledOnce();

    await Promise.all([api.close(), worker.close()]);
  });

  it('closes jobs, realtime, and the database once in order', async () => {
    const application = createApplicationComposition({ role: 'api' });
    const order: string[] = [];
    vi.spyOn(application.jobRepository, 'stop').mockImplementation(() => {
      order.push('jobs');
      return Promise.resolve();
    });
    vi.spyOn(application.eventRepository, 'stop').mockImplementation(() => {
      order.push('realtime');
      return Promise.resolve();
    });
    const destroy = application.database.destroy.bind(application.database);
    vi.spyOn(application.database, 'destroy').mockImplementation(async () => {
      order.push('database');
      await destroy();
    });

    await application.close();
    await application.close();

    expect(order).toEqual(['jobs', 'realtime', 'database']);
  });
});
