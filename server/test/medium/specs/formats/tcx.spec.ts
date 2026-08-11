import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ConsoleLogger } from '@nestjs/common';

import { TcxRepository } from 'src/repositories/tcx.repository';
import { findStream, parseFitMessages } from 'src/utils/fit';

import { activityFixtures, hasTestAsset } from 'test/medium/utils';

const tcxRepository = new TcxRepository(new ConsoleLogger({ logLevels: [] }));

const parsed = () => parseFitMessages(tcxRepository.decode(readFileSync(activityFixtures.orsaAlpineSki.path)));

describe.skipIf(!hasTestAsset(activityFixtures.orsaAlpineSki))(
  'parseFitMessages against a real Garmin .tcx recording',
  () => {
    it('reads the activity summary', () => {
      const activity = parsed();

      expect(activity.sport).toBe('other');
      expect(activity.startedAt).toEqual(new Date('2013-01-13T09:16:35.000Z'));
      expect(activity.elapsedTime).toBe(10_962);
      expect(activity.movingTime).toBe(10_962);
      expect(activity.distance).toBeCloseTo(29_823.963, 3);
      expect(activity.calories).toBe(1690);
    });

    it('produces aligned position and distance streams', () => {
      const activity = parsed();
      const lengths = new Set(activity.streams.map((stream) => stream.data.length));

      expect(lengths.size).toBe(1);
      expect(findStream(activity, 'latitude')?.length).toBeGreaterThan(0);
      expect(findStream(activity, 'longitude')?.length).toBeGreaterThan(0);
      expect(findStream(activity, 'distance')?.length).toBeGreaterThan(0);
    });
  },
);
