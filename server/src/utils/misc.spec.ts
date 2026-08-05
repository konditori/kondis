import { describe, expect, it } from 'vitest';

import { getKeyByValue, getMethodNames } from 'src/utils/misc';

class Base {
  inherited(): void {}
}

class Child extends Base {
  readonly field = () => {};

  own(): void {}

  get trap(): never {
    throw new Error('a getter must never be evaluated during discovery');
  }
}

describe('getMethodNames', () => {
  const names = getMethodNames(new Child());

  it('finds methods on the class and its ancestors', () => {
    expect(names).toContain('own');
    expect(names).toContain('inherited');
  });

  it('stops before Object.prototype', () => {
    expect(names).not.toContain('toString');
    expect(names).not.toContain('hasOwnProperty');
  });

  it('ignores instance fields, which are not on the prototype', () => {
    expect(names).not.toContain('field');
  });

  it('does not evaluate getters', () => {
    // Reading one to check for decorator metadata would run arbitrary code at startup.
    expect(names).not.toContain('trap');
  });
});

describe('getKeyByValue', () => {
  enum Example {
    First = 'first',
    Second = 'second',
  }

  it('maps a value back to its member name', () => {
    expect(getKeyByValue(Example, 'second')).toBe('Second');
  });

  it('returns undefined for a value that is not in the enum', () => {
    expect(getKeyByValue(Example, 'third')).toBeUndefined();
  });
});
