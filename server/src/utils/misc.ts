export class KondisStartupError extends Error {}

export const getMethodNames = (instance: object): string[] => {
  const names = new Set<string>();

  for (
    let prototype: object | null = Object.getPrototypeOf(instance);
    prototype && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === 'constructor') {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      // Skip getters: reading one to check for metadata would run arbitrary code during startup.
      if (descriptor && typeof descriptor.value === 'function') {
        names.add(name);
      }
    }
  }

  return [...names];
};

export const getKeyByValue = <T extends Record<string, string>>(target: T, value: string): string | undefined =>
  Object.keys(target).find((key) => target[key] === value);

export const asErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
