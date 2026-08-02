import { FitBaseType, FitEncoder } from 'fit-file-parser';
import { describe, expect, it } from 'vitest';

import { FitDecodeError, decodeFit } from 'src/domain/fit/fit-decoder';

/**
 * These build FIT binaries rather than reading a recording, so the suite stays runnable without
 * the `test/test-assets` submodule. Decoding a real device file is covered by the medium suite.
 */
const MESG_FILE_ID = 0;
const MESG_SESSION = 18;
const MESG_LAP = 19;
const MESG_RECORD = 20;

const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;

const enumField = (number: number, value: number) => ({ number, size: 1, baseType: FitBaseType.Enum, value });
const uint8 = (number: number, value: number) => ({ number, size: 1, baseType: FitBaseType.Uint8, value });
const sint8 = (number: number, value: number) => ({ number, size: 1, baseType: FitBaseType.Sint8, value });
const uint16 = (number: number, value: number) => ({ number, size: 2, baseType: FitBaseType.Uint16, value });
const sint32 = (number: number, value: number) => ({ number, size: 4, baseType: FitBaseType.Sint32, value });
const uint32 = (number: number, value: number) => ({ number, size: 4, baseType: FitBaseType.Uint32, value });

const startedAt = new Date('2024-03-01T06:00:00.000Z');
const endedAt = new Date('2024-03-01T07:00:00.000Z');

const timestamp = (date: Date) => uint32(253, FitEncoder.toFitTimestamp(date));

const buildFitFile = (): Buffer => {
  const encoder = new FitEncoder();

  encoder.writeMessage(MESG_FILE_ID, [
    enumField(0, 4), // type: activity
    uint16(1, 1), // manufacturer: garmin
    uint32(4, FitEncoder.toFitTimestamp(startedAt)),
  ]);

  encoder.writeMessage(MESG_RECORD, [
    timestamp(startedAt),
    sint32(0, Math.round(57.7 * SEMICIRCLES_PER_DEGREE)), // position_lat
    sint32(1, Math.round(12.47 * SEMICIRCLES_PER_DEGREE)), // position_long
    uint16(2, (179 + 500) * 5), // altitude, scale 5 offset -500
    uint8(3, 142), // heart_rate
    uint8(4, 86), // cadence
    uint32(5, 1234 * 100), // distance, scale 100
    uint16(7, 230), // power
    sint8(13, 17), // temperature
    uint32(73, 2750), // enhanced_speed, scale 1000
  ]);

  encoder.writeMessage(MESG_LAP, [
    timestamp(endedAt),
    uint32(2, FitEncoder.toFitTimestamp(startedAt)), // start_time
    uint32(7, 3600 * 1000), // total_elapsed_time
    uint32(8, 3550 * 1000), // total_timer_time
    uint32(9, 10_000 * 100), // total_distance
    uint16(13, 2800), // avg_speed
    uint8(15, 150), // avg_heart_rate
    uint8(16, 178), // max_heart_rate
    uint16(19, 240), // avg_power
  ]);

  encoder.writeMessage(MESG_SESSION, [
    timestamp(endedAt),
    uint32(2, FitEncoder.toFitTimestamp(startedAt)), // start_time
    enumField(5, 1), // sport: running
    enumField(6, 0), // sub_sport: generic
    uint32(7, 3600 * 1000), // total_elapsed_time
    uint32(8, 3550 * 1000), // total_timer_time
    uint32(9, 10_000 * 100), // total_distance
    uint16(11, 700), // total_calories
    uint16(14, 2800), // avg_speed
    uint16(15, 4500), // max_speed
    uint8(16, 150), // avg_heart_rate
    uint8(17, 178), // max_heart_rate
    uint8(18, 85), // avg_cadence
    uint8(19, 95), // max_cadence
    uint16(20, 240), // avg_power
    uint16(21, 410), // max_power
    uint16(22, 120), // total_ascent
    uint16(23, 118), // total_descent
    uint16(34, 255), // normalized_power
  ]);

  return Buffer.from(encoder.close());
};

describe('decodeFit', () => {
  it('exposes session fields under their camelCase names', () => {
    const session = decodeFit(buildFitFile()).sessionMesgs?.[0];

    expect(session).toMatchObject({
      sport: 'running',
      subSport: 'generic',
      totalElapsedTime: 3600,
      totalTimerTime: 3550,
      totalDistance: 10_000,
      totalCalories: 700,
      avgSpeed: 2.8,
      maxSpeed: 4.5,
      avgHeartRate: 150,
      maxHeartRate: 178,
      avgCadence: 85,
      maxCadence: 95,
      avgPower: 240,
      maxPower: 410,
      totalAscent: 120,
      totalDescent: 118,
      normalizedPower: 255,
    });
    expect(session?.startTime).toEqual(startedAt);
  });

  it('exposes record fields under their camelCase names', () => {
    const records = decodeFit(buildFitFile()).recordMesgs;

    expect(records).toHaveLength(1);
    expect(records?.[0]).toMatchObject({
      altitude: 179,
      heartRate: 142,
      cadence: 86,
      distance: 1234,
      power: 230,
      temperature: 17,
      enhancedSpeed: 2.75,
    });
    expect(records?.[0].timestamp).toEqual(startedAt);
  });

  it('exposes lap fields under their camelCase names', () => {
    const laps = decodeFit(buildFitFile()).lapMesgs;

    expect(laps).toHaveLength(1);
    expect(laps?.[0]).toMatchObject({
      totalElapsedTime: 3600,
      totalTimerTime: 3550,
      totalDistance: 10_000,
      avgSpeed: 2.8,
      avgHeartRate: 150,
      maxHeartRate: 178,
      avgPower: 240,
    });
  });

  it('reports position in degrees rather than semicircles', () => {
    const record = decodeFit(buildFitFile()).recordMesgs?.[0];

    expect(record?.positionLat).toBeCloseTo(57.7, 5);
    expect(record?.positionLong).toBeCloseTo(12.47, 5);
  });

  it('keeps the readable part of a file with a corrupt trailing CRC', () => {
    const corrupted = buildFitFile();
    corrupted[corrupted.length - 1] ^= 0xff;

    expect(decodeFit(corrupted).recordMesgs).toHaveLength(1);
  });

  it.each([
    ['an empty buffer', Buffer.alloc(0)],
    ['a buffer too short to hold a header', Buffer.from([1, 2, 3])],
    ['a buffer with no FIT header', Buffer.alloc(1024, 7)],
  ])('rejects %s', (_label, contents) => {
    expect(() => decodeFit(contents)).toThrow(FitDecodeError);
    expect(() => decodeFit(contents)).toThrow(/not a valid FIT file/);
  });
});
