export type FitRecordMesg = {
  timestamp?: Date | number;
  // Semicircles on most devices. `parse-fit` normalises to degrees
  positionLat?: number;
  positionLong?: number;
  altitude?: number;
  enhancedAltitude?: number;
  distance?: number;
  speed?: number;
  enhancedSpeed?: number;
  heartRate?: number;
  cadence?: number;
  power?: number;
  temperature?: number;
};

export type FitSessionMesg = {
  sport?: string | number;
  subSport?: string | number;
  startTime?: Date | number;
  totalElapsedTime?: number;
  // FIT's "timer time", i.e. moving time with auto-pause excluded.
  totalTimerTime?: number;
  totalDistance?: number;
  totalAscent?: number;
  totalDescent?: number;
  avgSpeed?: number;
  enhancedAvgSpeed?: number;
  maxSpeed?: number;
  enhancedMaxSpeed?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgPower?: number;
  maxPower?: number;
  normalizedPower?: number;
  totalCalories?: number;
};

export type FitLapMesg = {
  startTime?: Date | number;
  totalElapsedTime?: number;
  totalTimerTime?: number;
  totalDistance?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgPower?: number;
  avgSpeed?: number;
  enhancedAvgSpeed?: number;
};

export type FitMessages = {
  sessionMesgs?: FitSessionMesg[];
  recordMesgs?: FitRecordMesg[];
  lapMesgs?: FitLapMesg[];
};
