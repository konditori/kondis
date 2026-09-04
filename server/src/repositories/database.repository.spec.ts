import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger } from 'src/logger';

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  migrateDown: vi.fn(),
  migrateToLatest: vi.fn(),
  Migrator: vi.fn(),
  FileMigrationProvider: vi.fn(),
}));

vi.mock('src/db/database', async (importOriginal) => ({
  ...(await importOriginal()),
  createDatabase: mocks.createDatabase,
}));

vi.mock('kysely/migration', () => ({
  FileMigrationProvider: mocks.FileMigrationProvider,
  Migrator: mocks.Migrator,
}));

import { DatabaseRepository, migrateDatabase } from 'src/repositories/database.repository';

describe(DatabaseRepository.name, () => {
  const db = {
    transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.Migrator.mockImplementation(function () {
      return {
        migrateDown: mocks.migrateDown,
        migrateToLatest: mocks.migrateToLatest,
      };
    });
    mocks.FileMigrationProvider.mockImplementation(function (options) {
      return options;
    });
  });

  it('executes the callback in a database transaction', async () => {
    const execute = vi.fn().mockResolvedValue('result');
    db.transaction.mockReturnValue({ execute });
    const callback = vi.fn();
    const repository = new DatabaseRepository(db as never);

    await expect(repository.withTransaction(callback)).resolves.toBe('result');

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(callback);
  });

  it('runs all migrations and logs successful completion', async () => {
    mocks.migrateToLatest.mockResolvedValue({
      results: [{ migrationName: '001-initial', direction: 'Up', status: 'Success' }],
    });
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const repository = new DatabaseRepository(db as never);

    await repository.runMigrations();

    expect(mocks.migrateToLatest).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('Migration "001-initial" up succeeded');
    log.mockRestore();
  });

  it('throws when applying migrations fails', async () => {
    const error = new Error('migration failed');
    mocks.migrateToLatest.mockResolvedValue({ error, results: [] });
    const repository = new DatabaseRepository(db as never);

    await expect(repository.runMigrations()).rejects.toBe(error);
  });

  it('returns the name of the latest successfully reverted migration', async () => {
    mocks.migrateDown.mockResolvedValue({
      results: [
        { migrationName: '002-add-index', direction: 'Down', status: 'Success' },
        { migrationName: '001-initial', direction: 'Up', status: 'Success' },
      ],
    });
    const repository = new DatabaseRepository(db as never);

    await expect(repository.revertLastMigration()).resolves.toBe('002-add-index');
  });

  it('returns undefined when no migration was reverted', async () => {
    mocks.migrateDown.mockResolvedValue({ results: [] });
    const repository = new DatabaseRepository(db as never);

    await expect(repository.revertLastMigration()).resolves.toBeUndefined();
  });

  it('destroys the database after running migrations', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const database = { destroy };
    mocks.createDatabase.mockReturnValue(database);
    mocks.migrateToLatest.mockResolvedValue({ results: [] });

    await migrateDatabase({} as never);

    expect(mocks.createDatabase).toHaveBeenCalledWith({});
    expect(mocks.migrateToLatest).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('reverts a migration when the down direction is requested', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.createDatabase.mockReturnValue({ destroy });
    mocks.migrateDown.mockResolvedValue({ results: [] });

    await migrateDatabase({} as never, 'down');

    expect(mocks.migrateDown).toHaveBeenCalledOnce();
    expect(mocks.migrateToLatest).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('destroys the database when migration execution fails', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const error = new Error('migration failed');
    mocks.createDatabase.mockReturnValue({ destroy });
    mocks.migrateToLatest.mockResolvedValue({ error, results: [] });

    await expect(migrateDatabase({} as never)).rejects.toBe(error);
    expect(destroy).toHaveBeenCalledOnce();
  });
});
