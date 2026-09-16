import { ConsoleLogger } from 'src/logger';
import type { BaseServiceDeps } from 'src/services/base.service';

export type TestService<T, M extends Record<string, unknown>> = {
  sut: T;
  mocks: M;
};

export const newTestService = <T, M extends Record<string, unknown>>(
  Service: new (...dependencies: never[]) => T,
  dependencies: readonly unknown[],
  mocks: M,
): TestService<T, M> => ({
  sut: new Service(...(dependencies as never[])),
  mocks,
});

// Builds a complete BaseServiceDeps with inert stand-ins, so specs only wire
// the repositories their subject actually calls.
export const newServiceDeps = (overrides: Partial<BaseServiceDeps>): BaseServiceDeps => ({
  activityRepository: {} as never,
  configRepository: {} as never,
  cryptoRepository: {} as never,
  databaseRepository: {} as never,
  eventRepository: {} as never,
  fitRepository: {} as never,
  gpxRepository: {} as never,
  jobRepository: {} as never,
  liveActivityRepository: {} as never,
  logger: new ConsoleLogger({ logLevels: [] }),
  mediaRepository: {} as never,
  rateLimitingRepository: {} as never,
  sessionRepository: {} as never,
  socialRepository: {} as never,
  storageRepository: {} as never,
  takeoutRepository: {} as never,
  tcxRepository: {} as never,
  uploadRepository: {} as never,
  userRepository: {} as never,
  ...overrides,
});
