import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfigRepository } from 'src/repositories/config.repository';

describe('ConfigRepository', () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = process.env;
    process.env = {
      KONDIS_DB_USERNAME: 'kondis',
      KONDIS_DB_PASSWORD: 'kondis',
      KONDIS_DB_DATABASE_NAME: 'kondis',
    };
  });

  afterEach(() => {
    process.env = original;
  });

  describe('environment cache', () => {
    it('caches the parsed environment per repository', () => {
      const repository = new ConfigRepository();
      const first = repository.getEnv();

      process.env.KONDIS_PORT = '8080';

      expect(repository.getEnv()).toBe(first);
      expect(repository.getEnv().port).toBe(2293);
    });

    it('uses a fresh cache for a new repository', () => {
      process.env.KONDIS_PORT = '8080';

      expect(new ConfigRepository().getEnv().port).toBe(8080);
    });
  });

  describe('database defaults', () => {
    it('uses the Docker Compose database service when the hostname is unset', () => {
      expect(new ConfigRepository().getEnv().database.host).toBe('database');
    });

    it('uses the configured database hostname when provided', () => {
      process.env.KONDIS_DB_HOSTNAME = 'localhost';

      expect(new ConfigRepository().getEnv().database.host).toBe('localhost');
    });

    it('rejects an invalid database port', () => {
      process.env.KONDIS_DB_PORT = '5432.5';

      expect(() => new ConfigRepository().getEnv()).toThrow(/KONDIS_DB_PORT must be a positive integer/);
    });

    it('rejects an invalid server port', () => {
      process.env.KONDIS_PORT = 'not-a-port';

      expect(() => new ConfigRepository().getEnv()).toThrow(/KONDIS_PORT must be a positive integer/);
    });
  });

  describe('server defaults', () => {
    it('listens on all interfaces by default', () => {
      expect(new ConfigRepository().getEnv().listenAddress).toBe('0.0.0.0');
    });

    it('uses the configured listen address when provided', () => {
      process.env.KONDIS_LISTEN_ADDRESS = '127.0.0.1';

      expect(new ConfigRepository().getEnv().listenAddress).toBe('127.0.0.1');
    });
  });
});
