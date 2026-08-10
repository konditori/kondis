import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ConsoleLogger } from '@nestjs/common';

import { FitRepository } from 'src/repositories/fit.repository';
import { findStream, parseFitMessages } from 'src/utils/fit';

import { activityFixtures, hasTestAsset } from 'test/medium/utils';

const fitRepository = new FitRepository(new ConsoleLogger({ logLevels: [] }));

const parsed = () => parseFitMessages(fitRepository.decode(readFileSync(activityFixtures.hindasRun.path)));

describe.skipIf(!hasTestAsset(activityFixtures.hindasRun))(
  'parseFitMessages against a real Garmin .fit recording',
  () => {
    it('reads the session summary', () => {
      const activity = parsed();

      expect(activity.sport).toBe('running');
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
      // Every stream must share one length, otherwise sample N of one series does not correspond
      // to sample N of another.
      expect(lengths.size).toBe(1);
    });

    it('converts position into plausible degrees', () => {
      const activity = parsed();
      const latitude = findStream(activity, 'latitude');
      const longitude = findStream(activity, 'longitude');

      // Hindås, Sweden.
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
  },
);
