/**
 * Non-finite samples are skipped throughout, so a sensor dropout cannot poison a result.
 *
 * Written as explicit loops rather than reduce/spread deliberately: a long activity can hold
 * tens of thousands of samples, and `Math.max(...values)` overflows the call stack well before
 * that. These also allocate nothing.
 */
export const mean = (values: number[]): number | null => {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }

    total += value;
    count++;
  }
  return count === 0 ? null : total / count;
};

export const max = (values: number[]): number | null => {
  let result: number | null = null;
  for (const value of values) {
    if (Number.isFinite(value) && (result === null || value > result)) {
      result = value;
    }
  }
  return result;
};

/**
 * Rolling average over a fixed sample count. Used as the first stage of normalized power.
 */
export const rollingAverage = (values: number[], windowSize: number): number[] => {
  if (windowSize <= 1 || values.length === 0) {
    return [...values];
  }

  const result: number[] = [];
  let sum = 0;
  for (let index = 0; index < values.length; index++) {
    const value = Number.isFinite(values[index]) ? values[index] : 0;
    sum += value;

    if (index >= windowSize) {
      const leaving = Number.isFinite(values[index - windowSize]) ? values[index - windowSize] : 0;
      sum -= leaving;
    }

    const count = Math.min(index + 1, windowSize);
    result.push(sum / count);
  }

  return result;
};

export const roundOrNull = (value: number | null): number | null => (value === null ? null : Math.round(value));

export const inferSampleIntervalS = (time: number[]): number => {
  if (time.length < 2) {
    return 1;
  }

  const deltas: number[] = [];
  for (let index = 1; index < time.length; index++) {
    const delta = time[index] - time[index - 1];
    if (Number.isFinite(delta) && delta > 0) {
      deltas.push(delta);
    }
  }

  if (deltas.length === 0) {
    return 1;
  }

  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
};

export const lastFinite = (values: number[]): number | undefined => {
  for (let index = values.length - 1; index >= 0; index--) {
    if (Number.isFinite(values[index])) {
      return values[index];
    }
  }
  return;
};

export const num = (value?: number | null): number | null =>
  value !== undefined && value !== null && Number.isFinite(value) ? value : null;

export const int = (value?: number | null): number | null => {
  const parsed = num(value);
  return parsed === null ? null : Math.round(parsed);
};