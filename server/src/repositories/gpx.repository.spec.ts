import { ConsoleLogger } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { GpxDecodeError, GpxRepository } from 'src/repositories/gpx.repository';

const makeRepository = () => new GpxRepository(new ConsoleLogger({ logLevels: [] }));

const decode = (xml: string) => makeRepository().decode(Buffer.from(xml, 'utf8'));

const SAMPLE_GPX = `
<gpx version="1.1" creator="Kondis" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata>
    <time>2024-03-01T06:00:00.000Z</time>
    <type>Running</type>
  </metadata>
  <trk>
    <name>Morning Run</name>
    <type>Running</type>
    <trkseg>
      <trkpt lat="57.700000" lon="12.470000">
        <ele>100</ele>
        <time>2024-03-01T06:00:00.000Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>130</gpxtpx:hr>
            <gpxtpx:cad>82</gpxtpx:cad>
            <gpxtpx:power>210</gpxtpx:power>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
      <trkpt lat="57.700900" lon="12.470000">
        <ele>101</ele>
        <time>2024-03-01T06:01:00.000Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>145</gpxtpx:hr>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
`;

const MULTI_SEGMENT_GPX = `
<gpx version="1.1" creator="Kondis" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <time>2024-03-01T06:00:00.000Z</time>
    <type>Running</type>
  </metadata>
  <trk>
    <name>Morning Run</name>
    <trkseg>
      <trkpt lat="57.700000" lon="12.470000"><time>2024-03-01T06:00:00.000Z</time></trkpt>
      <trkpt lat="57.700900" lon="12.470000"><time>2024-03-01T06:01:00.000Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="57.701800" lon="12.470000"><time>2024-03-01T06:02:00.000Z</time></trkpt>
      <trkpt lat="57.702700" lon="12.470000"><time>2024-03-01T06:03:00.000Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>
`;

const ROUTE_ONLY_GPX = `
<gpx version="1.1" creator="Kondis" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <time>2024-03-01T06:00:00.000Z</time>
    <type>Cycling</type>
  </metadata>
  <rte>
    <name>Route example</name>
    <rtept lat="57.700000" lon="12.470000"><time>2024-03-01T06:00:00.000Z</time></rtept>
    <rtept lat="57.700900" lon="12.470000"><time>2024-03-01T06:01:00.000Z</time></rtept>
  </rte>
</gpx>
`;

describe('GpxRepository', () => {
  describe('decode', () => {
    it('maps GPX track data into the FIT-like message shape', () => {
      const decoded = decode(SAMPLE_GPX);

      expect(decoded.sessionMesgs?.[0]).toMatchObject({
        sport: 'running',
        totalElapsedTime: 60,
      });
      expect(decoded.sessionMesgs?.[0].startTime).toEqual(new Date('2024-03-01T06:00:00.000Z'));
      expect(decoded.sessionMesgs?.[0].totalDistance).toBeGreaterThan(90);
      expect(decoded.sessionMesgs?.[0].totalDistance).toBeLessThan(110);

      expect(decoded.lapMesgs).toHaveLength(1);
      expect(decoded.lapMesgs?.[0].startTime).toEqual(new Date('2024-03-01T06:00:00.000Z'));
      expect(decoded.lapMesgs?.[0].totalElapsedTime).toBe(60);

      expect(decoded.recordMesgs).toHaveLength(2);
      expect(decoded.recordMesgs?.[0]).toMatchObject({
        positionLat: 57.7,
        positionLong: 12.47,
        altitude: 100,
        heartRate: 130,
        cadence: 82,
        power: 210,
      });
      expect(decoded.recordMesgs?.[0].timestamp).toEqual(new Date('2024-03-01T06:00:00.000Z'));
      expect(decoded.recordMesgs?.[1].distance).toBeGreaterThan(decoded.recordMesgs?.[0].distance ?? -1);
      expect(decoded.recordMesgs?.[1].speed).toBeGreaterThan(1.5);
      expect(decoded.recordMesgs?.[1].speed).toBeLessThan(2);
    });

    it('keeps distance cumulative across multiple track segments', () => {
      const decoded = decode(MULTI_SEGMENT_GPX);

      expect(decoded.recordMesgs).toHaveLength(4);
      expect(decoded.recordMesgs?.[0].distance).toBeCloseTo(0, 6);
      expect(decoded.recordMesgs?.[1].distance).toBeGreaterThan(90);
      expect(decoded.recordMesgs?.[3].distance).toBeGreaterThan(decoded.recordMesgs?.[1].distance ?? 0);
      expect(decoded.sessionMesgs?.[0].totalDistance).toBeGreaterThan(180);
      expect(decoded.sessionMesgs?.[0].totalDistance).toBeLessThan(220);
      expect(decoded.sessionMesgs?.[0].totalElapsedTime).toBe(180);
    });

    it('maps route-only GPX files', () => {
      const decoded = decode(ROUTE_ONLY_GPX);

      expect(decoded.sessionMesgs?.[0]).toMatchObject({
        sport: 'cycling',
        totalElapsedTime: 60,
      });
      expect(decoded.recordMesgs).toHaveLength(2);
      expect(decoded.lapMesgs).toHaveLength(1);
      expect(decoded.recordMesgs?.[1].distance).toBeGreaterThan(90);
    });

    it('rejects empty input', () => {
      expect(() => makeRepository().decode(Buffer.alloc(0))).toThrow(GpxDecodeError);
      expect(() => makeRepository().decode(Buffer.alloc(0))).toThrow(/empty file/);
    });

    it('rejects malformed XML', () => {
      expect(() => decode('<')).toThrow(GpxDecodeError);
      expect(() => decode('<')).toThrow(/malformed XML/);
    });

    it('rejects XML without points', () => {
      const xml = '<gpx version="1.1" creator="Kondis" xmlns="http://www.topografix.com/GPX/1/1" />';
      expect(() => decode(xml)).toThrow(GpxDecodeError);
      expect(() => decode(xml)).toThrow(/no track or route points found/);
    });
  });
});
