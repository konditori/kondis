import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findStream } from 'src/domain/activity/parsed-activity';
import { decodeFit } from 'src/domain/fit/fit-decoder';
import { parseFitMessages } from 'src/domain/fit/parse-fit';

/**
 * Exercises the real Garmin SDK against a real device recording, which the unit tests in
 * parse-fit.spec.ts deliberately avoid.
 *
 * The fixture lives in the repo-root `test/test-assets` folder, so this suite skips itself when
 * the fixture has not been checked out.
 */
const fixturePath = resolve(
  process.cwd(),
  '..',
  'test',
  'test-assets',
  'activities',
  'running',
  '2015-hindas',
  '2015-06-22-run.fit',
);

const hasFixture = existsSync(fixturePath);

const parsed = () => parseFitMessages(decodeFit(readFileSync(fixturePath)));

describe.skipIf(!hasFixture)('parseFitMessages against a real Garmin .fit recording', () => {
  it('reads the session summary', () => {
    const activity = parsed();

    expect(activity.sport).toBe('running');
    expect(activity.startedAt.getUTCFullYear()).toBe(2015);
    expect(activity.distanceM).toBeGreaterThan(10_000);
    expect(activity.distanceM).toBeLessThan(10_100);
    expect(activity.movingTimeS).toBeGreaterThan(4000);
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
    // ~7:19 per kilometre.
    expect(activity.avgSpeedMps).toBeCloseTo(2.28, 1);
  });

  it('keeps elevation gain within a plausible range for a 70m altitude spread', () => {
    const activity = parsed();

    // Raw accumulation of this stream reports 694m, which is GPS noise rather than climbing.
    // Smoothing brings it to roughly 285m. This bound is a regression guard, not ground truth:
    // the real figure has never been validated against a reference.
    expect(activity.elevationGainM).toBeGreaterThan(100);
    expect(activity.elevationGainM).toBeLessThan(400);

    // A loop should climb and descend roughly the same amount.
    const asymmetry = Math.abs(activity.elevationGainM! - activity.elevationLossM!);
    expect(asymmetry).toBeLessThan(50);
  });
});
