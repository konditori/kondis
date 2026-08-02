/**
 * Thrown for a misconfiguration that can only be fixed by changing code or configuration, so
 * the process must not come up. Distinct from a runtime error, which is retried or logged.
 */
export class KondisStartupError extends Error {}

/**
 * Every method on an instance's class, walking the prototype chain but stopping short of
 * `Object.prototype`.
 *
 * `Object.keys(instance)` would return fields, not methods; methods live on the prototype.
 * Needed so decorator discovery can find handlers without a hard-coded list.
 */
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

/** Reverse lookup for producing readable enum names in error messages. */
export const getKeyByValue = <T extends Record<string, string>>(target: T, value: string): string | undefined =>
  Object.keys(target).find((key) => target[key] === value);

export const asErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
