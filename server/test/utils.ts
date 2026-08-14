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
