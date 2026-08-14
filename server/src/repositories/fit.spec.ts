import { readFileSync } from 'node:fs';

import { ConsoleLogger } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { FitRepository } from 'src/repositories/fit.repository';
import { computeRunningBestEfforts } from 'src/utils/best-effort';
import { findStream, parseFitMessages } from 'src/utils/fit';

import { activityFixtures, syntheticActivityFixtures } from 'test/medium/utils';

const fitRepository = new FitRepository(new ConsoleLogger({ logLevels: [] }));
const parsed = () => parseFitMessages(fitRepository.decode(readFileSync(activityFixtures.hindasRun.path)));
const parsedSyntheticMissingDistance = () => {
  const messages = fitRepository.decode(readFileSync(syntheticActivityFixtures.missingRecordDistanceFit.path));
  return { activity: parseFitMessages(messages), messages };
};

describe('parseFitMessages against a synthetic .fit recording without record distances', () => {
  it('exercises the missing-distance shape without containing a real route', () => {
    const { messages } = parsedSyntheticMissingDistance();

    expect(messages.sessionMesgs?.[0]?.totalDistance).toBe(1000);
    expect(messages.recordMesgs).toHaveLength(6);
    expect(messages.recordMesgs?.every(({ distance }) => distance === undefined)).toBe(true);
    expect(messages.recordMesgs?.[0]?.positionLat).toBeCloseTo(0, 5);
    expect(messages.recordMesgs?.[0]?.positionLong).toBeCloseTo(-140, 5);
  });

  it('generates aligned streams and a usable cumulative distance stream', () => {
    const { activity } = parsedSyntheticMissingDistance();
    const lengths = new Set(activity.streams.map((stream) => stream.data.length));
    const distance = findStream(activity, 'distance');
    const time = findStream(activity, 'time');

    expect(activity.sport).toBe('run');
    expect(lengths).toEqual(new Set([6]));
    expect(findStream(activity, 'latitude')).toHaveLength(6);
    expect(findStream(activity, 'longitude')).toHaveLength(6);
    expect(distance).toHaveLength(6);
    expect(distance?.[0]).toBe(0);
    expect(distance?.at(-1)).toBeCloseTo(1000, 5);
    expect(distance?.every((value, index) => index === 0 || value >= distance[index - 1])).toBe(true);
    expect(computeRunningBestEfforts(distance!, time!).map(({ type }) => type)).toEqual(['400m', '1k', 'half_mile']);
  });
});

describe('parseFitMessages against a real Garmin .fit recording', () => {
  it('reads the session summary', () => {
    const activity = parsed();

    expect(activity.sport).toBe('run');
    expect(activity.startedAt.getUTCFullYear()).toBe(2015);
    expect(activity.distance).toBeGreaterThan(10_000);
    expect(activity.distance).toBeLessThan(10_100);
    expect(activity.movingTime).toBeGreaterThan(4000);
    expect(activity.calories).toBeGreaterThan(0);
    expect(activity.laps).toHaveLength(1);
  });

  it('produces index-aligned streams', () => {
    const activity = parsed();
    const lengths = new Set(activity.streams.map((stream) => stream.data.length));

    expect(activity.streams.length).toBeGreaterThan(0);
    expect(lengths.size).toBe(1);
  });

  it('converts position into plausible degrees', () => {
    const activity = parsed();
    const latitude = findStream(activity, 'latitude');
    const longitude = findStream(activity, 'longitude');

    expect(latitude?.[0]).toBeCloseTo(57.7, 1);
    expect(longitude?.[0]).toBeCloseTo(12.47, 1);
  });

  it('derives average speed even though the device recorded no speed', () => {
    const activity = parsed();

    expect(findStream(activity, 'speed')).toBeUndefined();
    expect(activity.avgSpeed).toBeCloseTo(2.28, 1);
  });

  it('keeps elevation gain within a plausible range for a 70m altitude spread', () => {
    const activity = parsed();

    expect(activity.elevationGain).toBeGreaterThan(135);
    expect(activity.elevationGain).toBeLessThan(160);

    const asymmetry = Math.abs(activity.elevationGain! - activity.elevationLoss!);
    expect(asymmetry).toBeLessThan(20);
  });
});
