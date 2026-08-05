import { describe, expect, it } from 'vitest';

import { FitMessages } from 'src/repositories/fit.repository';
import { findStream, FitParseError, parseFitMessages } from 'src/utils/fit';

const START = new Date('2015-06-22T08:00:00.000Z');
const at = (offsetS: number) => new Date(START.getTime() + offsetS * 1000);

// ~58.67N, ~11.73E in semicircles, which is how FIT stores position.
const LAT_SEMICIRCLES = 700_000_000;
const LON_SEMICIRCLES = 140_000_000;

describe('parseFitMessages', () => {
  it('prefers device session summaries over stream-derived values', () => {
    const messages: FitMessages = {
      sessionMesgs: [
        {
          sport: 'running',
          subSport: 'road',
          startTime: START,
          totalElapsedTime: 3600,
          totalTimerTime: 3500,
          totalDistance: 10_000,
          totalAscent: 120,
          totalDescent: 110,
          avgSpeed: 2.8,
          maxSpeed: 4.1,
          avgHeartRate: 150,
          maxHeartRate: 175,
          totalCalories: 700,
        },
      ],
      recordMesgs: [
        { timestamp: at(0), altitude: 10, heartRate: 120 },
        { timestamp: at(1), altitude: 40, heartRate: 130 },
      ],
    };

    const parsed = parseFitMessages(messages);

    expect(parsed.sport).toBe('running');
    expect(parsed.subSport).toBe('road');
    expect(parsed.startedAt.toISOString()).toBe(START.toISOString());
    expect(parsed.elapsedTime).toBe(3600);
    expect(parsed.movingTime).toBe(3500);
    expect(parsed.distance).toBe(10_000);
    expect(parsed.calories).toBe(700);
    expect(parsed.avgHr).toBe(150);
    expect(parsed.elevationGain).toBe(120);
  });

  it('converts position from semicircles to degrees', () => {
    const parsed = parseFitMessages({
      recordMesgs: [
        { timestamp: at(0), positionLat: LAT_SEMICIRCLES, positionLong: LON_SEMICIRCLES },
        { timestamp: at(1), positionLat: LAT_SEMICIRCLES, positionLong: LON_SEMICIRCLES },
      ],
    });

    expect(findStream(parsed, 'latitude')?.[0]).toBeCloseTo(58.673, 2);
    expect(findStream(parsed, 'longitude')?.[0]).toBeCloseTo(11.735, 2);
  });

  it('leaves already-converted degrees untouched', () => {
    const parsed = parseFitMessages({
      recordMesgs: [
        { timestamp: at(0), positionLat: 58.673, positionLong: 11.735 },
        { timestamp: at(1), positionLat: 58.674, positionLong: 11.736 },
      ],
    });

    expect(findStream(parsed, 'latitude')?.[0]).toBeCloseTo(58.673, 3);
  });

  it('derives summary values from streams when there is no session message', () => {
    const parsed = parseFitMessages({
      recordMesgs: [
        { timestamp: at(0), altitude: 100, distance: 0, speed: 0, heartRate: 100 },
        { timestamp: at(30), altitude: 110, distance: 3, speed: 3, heartRate: 140 },
        { timestamp: at(60), altitude: 105, distance: 6, speed: 3, heartRate: 160 },
      ],
    });

    expect(parsed.sport).toBe('unknown');
    expect(parsed.startedAt.toISOString()).toBe(START.toISOString());
    expect(parsed.elapsedTime).toBe(60);
    expect(parsed.distance).toBe(6);
    expect(parsed.elevationGain).toBe(5);
    expect(parsed.elevationLoss).toBe(0);
    expect(parsed.avgHr).toBe(133);
    expect(parsed.maxHr).toBe(160);
  });

  it('derives average speed from distance and time when the device recorded neither', () => {
    const parsed = parseFitMessages({
      sessionMesgs: [{ startTime: START, totalElapsedTime: 100, totalTimerTime: 100, totalDistance: 250 }],
      recordMesgs: [{ timestamp: at(0) }, { timestamp: at(100) }],
    });

    expect(parsed.avgSpeed).toBeCloseTo(2.5, 5);
  });

  it('builds a time stream in seconds relative to the start', () => {
    const parsed = parseFitMessages({
      recordMesgs: [{ timestamp: at(0) }, { timestamp: at(1) }, { timestamp: at(10) }],
    });

    expect(findStream(parsed, 'time')).toEqual([0, 1, 10]);
  });

  it('keeps streams index-aligned by padding gaps with NaN', () => {
    const parsed = parseFitMessages({
      recordMesgs: [
        { timestamp: at(0), heartRate: 120, power: 200 },
        { timestamp: at(1), heartRate: 130 },
        { timestamp: at(2), heartRate: 140, power: 210 },
      ],
    });

    const power = findStream(parsed, 'power');
    const heartrate = findStream(parsed, 'heartrate');

    expect(power).toHaveLength(3);
    expect(heartrate).toHaveLength(3);
    expect(power?.[0]).toBe(200);
    expect(Number.isNaN(power?.[1] as number)).toBe(true);
    expect(power?.[2]).toBe(210);
  });

  it('omits streams that have no samples at all', () => {
    const parsed = parseFitMessages({
      recordMesgs: [{ timestamp: at(0), heartRate: 120 }],
    });

    expect(findStream(parsed, 'heartrate')).toBeDefined();
    expect(findStream(parsed, 'power')).toBeUndefined();
    expect(findStream(parsed, 'latitude')).toBeUndefined();
  });

  it('accepts raw FIT epoch seconds as well as Date objects', () => {
    const fitSeconds = START.getTime() / 1000 - 631_065_600;
    const parsed = parseFitMessages({ recordMesgs: [{ timestamp: fitSeconds }] });

    expect(parsed.startedAt.toISOString()).toBe(START.toISOString());
  });

  it('maps laps with a zero-based index', () => {
    const parsed = parseFitMessages({
      sessionMesgs: [{ startTime: START, totalElapsedTime: 3600 }],
      lapMesgs: [
        { startTime: START, totalElapsedTime: 1800, totalDistance: 5000, avgHeartRate: 148 },
        { startTime: at(1800), totalElapsedTime: 1800, totalDistance: 5000, avgHeartRate: 155 },
      ],
    });

    expect(parsed.laps).toHaveLength(2);
    expect(parsed.laps[0].index).toBe(0);
    expect(parsed.laps[1].index).toBe(1);
    expect(parsed.laps[1].avgHr).toBe(155);
    expect(parsed.laps[1].distanceM).toBe(5000);
  });

  it('rejects a file with no usable timestamp', () => {
    expect(() => parseFitMessages({ recordMesgs: [{ heartRate: 120 }] })).toThrow(FitParseError);
    expect(() => parseFitMessages({})).toThrow(FitParseError);
  });
});
