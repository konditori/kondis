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
