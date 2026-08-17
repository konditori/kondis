import { ConsoleLogger, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

import { FitLapMesg, FitMessages, FitRecordMesg } from 'src/repositories/fit.repository';
import { haversineDistance } from 'src/utils/geo';

export class GpxDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GpxDecodeError';
  }
}

type MaybeArray<T> = T | T[] | undefined;

type GpxPoint = {
  lat?: number | string;
  lon?: number | string;
  ele?: number | string;
  time?: string;
  Extensions?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
};

type GpxTrackSegment = {
  trkpt?: MaybeArray<GpxPoint>;
};

type GpxTrack = {
  name?: string;
  type?: string;
  trkseg?: MaybeArray<GpxTrackSegment>;
  trkpt?: MaybeArray<GpxPoint>;
};

type GpxRoute = {
  name?: string;
  type?: string;
  rtept?: MaybeArray<GpxPoint>;
};

type GpxMetadata = {
  time?: string;
  type?: string;
  name?: string;
};

type GpxDocument = {
  metadata?: GpxMetadata;
  trk?: MaybeArray<GpxTrack>;
  rte?: MaybeArray<GpxRoute>;
};

type ParsedPoint = {
  record: FitRecordMesg;
  timestamp?: Date;
  lat?: number;
  lon?: number;
};

type ParsedSegment = {
  points: ParsedPoint[];
  label?: string;
  startTime?: Date;
  totalElapsedTime?: number;
  totalDistance?: number;
};

type GpxSegment = {
  points: GpxPoint[];
  label?: string;
};

@Injectable()
export class GpxRepository {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
  });

  constructor(private readonly logger: ConsoleLogger) {
    this.logger.setContext(GpxRepository.name);
  }

  decode(contents: Buffer): FitMessages {
    const xml = contents.toString('utf8').trim();
    if (xml.length === 0) {
      throw new GpxDecodeError('File is not a valid GPX file: empty file');
    }

    let raw: unknown;
    try {
      raw = this.xmlParser.parse(xml);
    } catch (error) {
      throw new GpxDecodeError('File is not a valid GPX file: malformed XML', { cause: error });
    }

    const gpx = this.getDocument(raw);
    const segments = this.getSegments(gpx);
    const recordMesgs: FitRecordMesg[] = [];
    const lapMesgs: FitLapMesg[] = [];
    let carriedDistance = 0;

    for (const segment of segments) {
      const mapped = this.mapSegment(segment.points, carriedDistance, segment.label);
      carriedDistance = mapped.totalDistance ?? carriedDistance;

      for (const point of mapped.points) {
        recordMesgs.push(point.record);
      }

      lapMesgs.push({
        startTime: mapped.startTime ?? mapped.points[0]?.timestamp,
        totalElapsedTime: mapped.totalElapsedTime,
        totalDistance: mapped.totalDistance,
      });
    }

    const startedAt = this.firstTimestamp(recordMesgs) ?? toDate(gpx.metadata?.time);
    const totalDistance = lastFinite(recordMesgs.map((record) => record.distance));

    return {
      sessionMesgs: [
        {
          sport: normalizeSport(gpx.metadata?.type ?? segments[0]?.label),
          startTime: startedAt,
          totalElapsedTime: this.totalElapsedTime(recordMesgs, startedAt),
          totalDistance,
        },
      ],
      recordMesgs,
      lapMesgs,
    };
  }

  private getDocument(raw: unknown): GpxDocument {
    const root = asRecord(raw);
    const gpx = asRecord(root?.gpx) ?? asRecord(root?.GPX) ?? asRecord(root?.Gpx);

    if (!gpx) {
      throw new GpxDecodeError('File is not a valid GPX file: missing gpx root element');
    }

    // SAFETY: getDocument confirms that the parsed XML has a GPX root before projecting its supported fields.
    return gpx as GpxDocument;
  }

  private getSegments(gpx: GpxDocument): GpxSegment[] {
    const segments: GpxSegment[] = [];

    for (const track of asArray(gpx.trk)) {
      const label = track.type?.trim() || track.name?.trim();
      const trackSegments = asArray(track.trkseg);

      if (trackSegments.length > 0) {
        for (const trackSegment of trackSegments) {
          const points = asArray(trackSegment.trkpt);
          if (points.length > 0) {
            segments.push({ points, label });
          }
        }
        continue;
      }

      const points = asArray(track.trkpt);
      if (points.length > 0) {
        segments.push({ points, label });
      }
    }

    for (const route of asArray(gpx.rte)) {
      const points = asArray(route.rtept);
      if (points.length > 0) {
        segments.push({ points, label: route.type?.trim() || route.name?.trim() });
      }
    }

    if (segments.length === 0) {
      throw new GpxDecodeError('File is not a valid GPX file: no track or route points found');
    }

    return segments;
  }

  private mapSegment(points: GpxPoint[], startingDistance = 0, label?: string): ParsedSegment {
    const parsedPoints: ParsedPoint[] = [];
    let previous: ParsedPoint | undefined;
    let totalDistance = startingDistance;

    for (const point of points) {
      const timestamp = toDate(point.time);
      const lat = toNumber(point.lat);
      const lon = toNumber(point.lon);
      const altitude = toNumber(point.ele);
      const extensions = asRecord(point.Extensions ?? point.extensions);
      const heartRate = this.extractInteger(extensions, ['hr', 'HeartRate']);
      const cadence = this.extractInteger(extensions, ['cad', 'cadence']);
      const power = this.extractInteger(extensions, ['power', 'Watts']);
      const temperature = this.extractNumber(extensions, ['atemp', 'temp', 'Temperature']);

      let distance = totalDistance;
      let speed: number | undefined;

      if (previous?.lat !== undefined && previous.lon !== undefined && lat !== undefined && lon !== undefined) {
        const step = haversineDistance(previous.lat, previous.lon, lat, lon);
        if (Number.isFinite(step)) {
          totalDistance += step;
          distance = totalDistance;

          if (previous.timestamp && timestamp) {
            const deltaTimeS = (timestamp.getTime() - previous.timestamp.getTime()) / 1000;
            if (deltaTimeS > 0) {
              speed = step / deltaTimeS;
            }
          }
        }
      }

      const record: FitRecordMesg = {
        timestamp,
        positionLat: lat,
        positionLong: lon,
        altitude,
        distance,
        speed,
        heartRate,
        cadence,
        power,
        temperature,
      };

      parsedPoints.push({ record, timestamp, lat, lon });
      previous = { record, timestamp, lat, lon };
    }

    return {
      points: parsedPoints,
      label,
      startTime: parsedPoints[0]?.timestamp,
      totalElapsedTime: this.totalElapsedTime(
        parsedPoints.map((point) => point.record),
        parsedPoints[0]?.timestamp,
      ),
      totalDistance: lastFinite(parsedPoints.map((point) => point.record.distance)),
    };
  }

  private extractNumber(extensions: Record<string, unknown> | undefined, keys: string[]): number | undefined {
    return toNumber(this.extractExtensionValue(extensions, keys));
  }

  private extractInteger(extensions: Record<string, unknown> | undefined, keys: string[]): number | undefined {
    const parsed = this.extractNumber(extensions, keys);
    return parsed === undefined ? undefined : Math.round(parsed);
  }

  private extractExtensionValue(extensions: Record<string, unknown> | undefined, keys: string[]): unknown {
    const node = asRecord(extensions);
    const extension = asRecord(node?.TrackPointExtension) ?? asRecord(node?.TrackpointExtension) ?? firstObject(node);

    for (const key of keys) {
      const value = extension?.[key];
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  private firstTimestamp(records: FitRecordMesg[]): Date | undefined {
    for (const record of records) {
      const timestamp = toDate(record.timestamp);
      if (timestamp) {
        return timestamp;
      }
    }

    return undefined;
  }

  private totalElapsedTime(records: FitRecordMesg[], startedAt: Date | undefined): number | undefined {
    if (!startedAt) {
      return undefined;
    }

    let lastTimestamp: Date | undefined;
    for (const record of records) {
      const timestamp = toDate(record.timestamp);
      if (timestamp) {
        lastTimestamp = timestamp;
      }
    }

    if (!lastTimestamp) {
      return undefined;
    }

    return Math.max(0, Math.round((lastTimestamp.getTime() - startedAt.getTime()) / 1000));
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  // SAFETY: The object and non-null checks establish a record-like value for XML traversal.
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

const asArray = <T>(value: MaybeArray<T>): T[] => {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const firstObject = (value: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!value) {
    return undefined;
  }

  for (const candidate of Object.values(value)) {
    const parsed = asRecord(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const normalizeSport = (value: unknown): string => {
  if (typeof value !== 'string') {
    return 'unknown';
  }

  return value.trim().toLowerCase() || 'unknown';
};

const lastFinite = (values: Array<number | undefined>): number | undefined => {
  for (let index = values.length - 1; index >= 0; index--) {
    const value = values[index];
    if (value !== undefined && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};
