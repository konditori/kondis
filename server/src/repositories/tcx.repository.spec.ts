import { ConsoleLogger } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { TcxDecodeError, TcxRepository } from 'src/repositories/tcx.repository';

const makeRepository = () => new TcxRepository(new ConsoleLogger({ logLevels: [] }));

const decode = (xml: string) => makeRepository().decode(Buffer.from(xml, 'utf8'));

const SAMPLE_TCX = `
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2024-03-01T06:00:00.000Z</Id>
      <Lap StartTime="2024-03-01T06:00:00.000Z">
        <TotalTimeSeconds>60</TotalTimeSeconds>
        <DistanceMeters>200</DistanceMeters>
        <Calories>12</Calories>
        <AverageHeartRateBpm><Value>140</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>150</Value></MaximumHeartRateBpm>
        <Track>
          <Trackpoint>
            <Time>2024-03-01T06:00:00.000Z</Time>
            <Position>
              <LatitudeDegrees>57.700000</LatitudeDegrees>
              <LongitudeDegrees>12.470000</LongitudeDegrees>
            </Position>
            <AltitudeMeters>100</AltitudeMeters>
            <DistanceMeters>0</DistanceMeters>
            <HeartRateBpm><Value>130</Value></HeartRateBpm>
            <Cadence>80</Cadence>
            <Extensions>
              <ns3:TPX>
                <ns3:Speed>3.10</ns3:Speed>
                <ns3:Watts>210</ns3:Watts>
              </ns3:TPX>
            </Extensions>
          </Trackpoint>
          <Trackpoint>
            <Time>2024-03-01T06:01:00.000Z</Time>
            <DistanceMeters>200</DistanceMeters>
            <HeartRateBpm><Value>145</Value></HeartRateBpm>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;

describe('TcxRepository', () => {
  describe('decode', () => {
    it('maps TCX activity data into the FIT-like message shape', () => {
      const decoded = decode(SAMPLE_TCX);

      expect(decoded.sessionMesgs?.[0]).toMatchObject({
        sport: 'running',
        totalElapsedTime: 60,
        totalTimerTime: 60,
        totalDistance: 200,
        totalCalories: 12,
        avgSpeed: 200 / 60,
      });
      expect(decoded.sessionMesgs?.[0].startTime).toEqual(new Date('2024-03-01T06:00:00.000Z'));

      expect(decoded.lapMesgs?.[0]).toMatchObject({
        totalElapsedTime: 60,
        totalDistance: 200,
        avgHeartRate: 140,
        maxHeartRate: 150,
      });

      expect(decoded.recordMesgs).toHaveLength(2);
      expect(decoded.recordMesgs?.[0]).toMatchObject({
        positionLat: 57.7,
        positionLong: 12.47,
        altitude: 100,
        distance: 0,
        heartRate: 130,
        cadence: 80,
        speed: 3.1,
        power: 210,
      });
      expect(decoded.recordMesgs?.[0].timestamp).toEqual(new Date('2024-03-01T06:00:00.000Z'));
    });

    it('rejects empty input', () => {
      expect(() => makeRepository().decode(Buffer.alloc(0))).toThrow(TcxDecodeError);
      expect(() => makeRepository().decode(Buffer.alloc(0))).toThrow(/empty file/);
    });

    it('rejects malformed XML', () => {
      expect(() => decode('<')).toThrow(TcxDecodeError);
      expect(() => decode('<')).toThrow(/malformed XML/);
    });

    it('rejects XML without an activity', () => {
      const xml = '<TrainingCenterDatabase><Activities /></TrainingCenterDatabase>';
      expect(() => decode(xml)).toThrow(TcxDecodeError);
      expect(() => decode(xml)).toThrow(/missing Activities\.Activity/);
    });
  });
});
