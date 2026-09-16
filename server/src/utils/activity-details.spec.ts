import { describe, expect, it } from 'vitest';

import { StreamType } from 'src/enum';
import { buildActivityAnalysis } from 'src/utils/activity-details';

describe('buildActivityAnalysis', () => {
  it('creates interpolated kilometre splits with heart rate and elevation', () => {
    const analysis = buildActivityAnalysis([
      { type: StreamType.Time, data: [0, 60, 120, 180] },
      { type: StreamType.Distance, data: [0, 500, 1000, 1500] },
      { type: StreamType.Altitude, data: [10, 15, 20, 25] },
      { type: StreamType.Heartrate, data: [100, 110, 120, 130] },
      { type: StreamType.Latitude, data: [57.7, 57.71, 57.72, 57.73] },
      { type: StreamType.Longitude, data: [11.9, 11.91, 11.92, 11.93] },
    ]);

    expect(analysis?.splits).toEqual([
      { distance: 1000, elapsedTime: 120, startTime: 0, endTime: 120, avgHr: 110, elevationChange: 10 },
      { distance: 500, elapsedTime: 60, startTime: 120, endTime: 180, avgHr: 125, elevationChange: 5 },
    ]);
    expect(analysis?.profile).toHaveLength(4);
    expect(analysis?.route).toHaveLength(4);
  });

  it('omits analysis when the activity has no aligned time and distance streams', () => {
    expect(buildActivityAnalysis([{ type: StreamType.Distance, data: [0, 1000] }])).toBeNull();
  });
});
