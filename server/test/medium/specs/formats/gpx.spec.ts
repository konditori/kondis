import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ConsoleLogger } from '@nestjs/common';

import { GpxRepository } from 'src/repositories/gpx.repository';
import { findStream, parseFitMessages } from 'src/utils/fit';

import { activityFixtures } from 'test/medium/utils';

const gpxRepository = new GpxRepository(new ConsoleLogger({ logLevels: [] }));

const parsed = () => parseFitMessages(gpxRepository.decode(readFileSync(activityFixtures.sampleRun.path)));

describe('parseFitMessages against a .gpx recording', () => {
  it('derives the activity summary from track points', () => {
    const activity = parsed();

    expect(activity.sport).toBe('run');
    expect(activity.startedAt).toEqual(new Date('2024-03-01T14:00:00.000Z'));
    expect(activity.elapsedTime).toBe(1980);
    expect(activity.movingTime).toBe(1980);
    expect(activity.distance).toBeGreaterThan(4500);
    expect(activity.distance).toBeLessThan(4700);
    expect(activity.avgSpeed).toBeGreaterThan(2.2);
    expect(activity.avgSpeed).toBeLessThan(2.5);
  });

  it('produces aligned position and sensor streams', () => {
    const activity = parsed();
    const lengths = new Set(activity.streams.map((stream) => stream.data.length));

    expect(lengths.size).toBe(1);
    expect(findStream(activity, 'latitude')).toHaveLength(45);
    expect(findStream(activity, 'longitude')).toHaveLength(45);
    expect(findStream(activity, 'heartrate')).toHaveLength(45);
    expect(findStream(activity, 'cadence')).toHaveLength(45);
  });

  it('starts and finishes at 181 Fremont', () => {
    const activity = parsed();
    const latitude = findStream(activity, 'latitude');
    const longitude = findStream(activity, 'longitude');

    expect(latitude?.[0]).toBeCloseTo(37.78977, 5);
    expect(longitude?.[0]).toBeCloseTo(-122.39535, 5);
    expect(latitude?.at(-1)).toBeCloseTo(37.78977, 5);
    expect(longitude?.at(-1)).toBeCloseTo(-122.39535, 5);
  });
});
