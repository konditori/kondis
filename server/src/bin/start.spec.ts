import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getApiPingUrl, stopRuntime } from 'src/bin/start';
import { WorkerType } from 'src/enum';

describe(getApiPingUrl.name, () => {
  const protocol = 'http';

  it.each([
    ['0.0.0.0', `${protocol}://127.0.0.1:3000/api/v1/ping`],
    ['::', `${protocol}://[::1]:3000/api/v1/ping`],
    ['2001:db8::1', `${protocol}://[2001:db8::1]:3000/api/v1/ping`],
    ['api.internal', `${protocol}://api.internal:3000/api/v1/ping`],
  ])('builds a polling URL for %s', (listenAddress, expected) => {
    expect(getApiPingUrl(listenAddress, 3000)).toBe(expected);
  });
});

describe(stopRuntime.name, () => {
  afterEach(() => vi.useRealTimers());

  it('force-kills an API process when graceful shutdown exceeds the timeout', () => {
    vi.useFakeTimers();
    const kill = vi.fn(() => true);
    const child = Object.assign(new EventEmitter(), { kill }) as unknown as ChildProcess;

    stopRuntime(child, WorkerType.API, 'SIGTERM');

    expect(kill).toHaveBeenCalledWith('SIGTERM');
    vi.runAllTimers();
    expect(kill).toHaveBeenLastCalledWith('SIGKILL');
  });

  it('cancels the force-kill when the API process exits gracefully', () => {
    vi.useFakeTimers();
    const kill = vi.fn(() => true);
    const child = Object.assign(new EventEmitter(), { kill }) as unknown as ChildProcess;

    stopRuntime(child, WorkerType.API, 'SIGINT');
    child.emit('exit', 0, null);
    vi.runAllTimers();

    expect(kill).toHaveBeenCalledOnce();
    expect(kill).toHaveBeenCalledWith('SIGINT');
  });
});
