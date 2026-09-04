import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { stopRuntime } from 'src/bin/start';
import { WorkerType } from 'src/enum';

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
