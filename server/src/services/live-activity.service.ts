import type { CryptoRepository } from 'src/contracts/crypto.repository';
import type { RealtimeRepository } from 'src/contracts/realtime.repository';
import { LiveActivityProgressEventStatus, LiveActivityStatus, type ActivityType } from 'src/enum';
import { NotFoundException } from 'src/errors';
import { LiveActivityRepository } from 'src/repositories/live-activity.repository';
import type { LiveActivityStatus as StoredLiveActivityStatus } from 'src/schema/tables/live-activity.table';

type PointInput = {
  sequence: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracyMeters: number;
};
const SHARE_LIFETIME_MS = 24 * 60 * 60 * 1000;

export class LiveService {
  constructor(
    private readonly liveRepository: LiveActivityRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly realtimeRepository: RealtimeRepository,
  ) {}

  async create(userId: string, input: { clientSessionId: string; sport: ActivityType; startedAt: string }) {
    const existing = await this.liveRepository.getByClientSessionId(userId, input.clientSessionId);
    const activity =
      existing ??
      (await this.liveRepository.create({
        userId,
        clientSessionId: input.clientSessionId,
        sport: input.sport,
        startedAt: new Date(input.startedAt),
      }));
    return this.toDto(activity, userId);
  }

  async list(userId: string) {
    const activities = await this.liveRepository.listActiveVisible(userId);
    return Promise.all(activities.map((activity) => this.toDto(activity, userId)));
  }

  async get(id: string, userId: string) {
    const activity = await this.liveRepository.getById(id, userId);
    if (!activity) {
      throw new NotFoundException('Live activity not found');
    }
    return this.toDto(activity, userId);
  }

  async getShared(token: string) {
    const activity = await this.liveRepository.getByShareTokenHash(await this.hashToken(token));
    if (!activity) {
      throw new NotFoundException('This live tracking link has expired or was revoked');
    }
    return this.toDto(activity);
  }

  async appendPoints(
    id: string,
    userId: string,
    input: { points: PointInput[]; elapsedSeconds: number; distanceMeters: number },
  ) {
    const activity = await this.liveRepository.getById(id, userId);
    if (!activity) {
      throw new NotFoundException('Live activity not found');
    }
    if (activity.status === LiveActivityStatus.Ended || activity.status === LiveActivityStatus.Discarded) {
      return { id: activity.id, lastSequence: activity.last_sequence };
    }
    await this.liveRepository.appendPoints(
      id,
      input.points.map((point) => ({
        ...point,
        altitude: point.altitude ?? null,
        recordedAt: new Date(point.recordedAt),
      })),
    );
    const updated = await this.liveRepository.updateProgress(
      id,
      activity.status,
      input.elapsedSeconds,
      input.distanceMeters,
    );
    const acknowledged = updated ?? activity;
    let latestPoint = input.points[0]!;
    for (const point of input.points.slice(1)) {
      if (point.sequence > latestPoint.sequence) {
        latestPoint = point;
      }
    }
    if (acknowledged.status !== LiveActivityStatus.Discarded) {
      await this.realtimeRepository.emit('LiveActivityUpdated', userId, {
        id: acknowledged.id,
        status: acknowledged.status as LiveActivityProgressEventStatus,
        elapsedSeconds: acknowledged.elapsed_seconds,
        distanceMeters: acknowledged.distance_meters,
        lastSequence: acknowledged.last_sequence,
        recordedAt: latestPoint.recordedAt,
        position: [latestPoint.longitude, latestPoint.latitude],
      });
    }
    return { id: acknowledged.id, lastSequence: acknowledged.last_sequence };
  }

  async updateState(
    id: string,
    userId: string,
    input: { status: Exclude<StoredLiveActivityStatus, 'discarded'>; elapsedSeconds: number; distanceMeters: number },
  ) {
    const activity = await this.liveRepository.getById(id, userId);
    if (!activity) {
      throw new NotFoundException('Live activity not found');
    }
    if (activity.status === LiveActivityStatus.Discarded) {
      return this.toDto(activity, userId);
    }
    const updated = await this.liveRepository.updateProgress(
      id,
      input.status,
      input.elapsedSeconds,
      input.distanceMeters,
    );
    return this.toDto(updated ?? activity, userId);
  }

  async createShare(id: string, userId: string) {
    const activity = await this.liveRepository.getById(id, userId);
    if (!activity) {
      throw new NotFoundException('Live activity not found');
    }
    const token = this.cryptoRepository.randomToken(24);
    const expiresAt = new Date(Date.now() + SHARE_LIFETIME_MS);
    await this.liveRepository.setShareToken(id, await this.hashToken(token), expiresAt);
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async revokeShare(id: string, userId: string): Promise<void> {
    const activity = await this.liveRepository.getById(id, userId);
    if (!activity) {
      throw new NotFoundException('Live activity not found');
    }
    await this.liveRepository.clearShareToken(id);
  }

  async discard(id: string, userId: string): Promise<void> {
    const activity = await this.liveRepository.getById(id, userId);
    if (!activity) {
      throw new NotFoundException('Live activity not found');
    }
    await this.liveRepository.clearShareToken(id);
    await this.liveRepository.updateProgress(
      id,
      LiveActivityStatus.Discarded,
      activity.elapsed_seconds,
      activity.distance_meters,
    );
  }

  // The public demo has one simulated device. This cleanup is deliberately
  // separate from discard(), which preserves a user's own activity history.
  async deleteOtherSessions(userId: string, clientSessionId: string): Promise<void> {
    await this.liveRepository.deleteOtherSessions(userId, clientSessionId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const activity = await this.liveRepository.getById(id, userId);
    if (!activity) {
      throw new NotFoundException('Live activity not found');
    }
    await this.liveRepository.deleteById(id, userId);
  }

  private async toDto(activity: Awaited<ReturnType<LiveActivityRepository['getById']>> & {}, viewerId?: string) {
    if (!activity) {
      throw new NotFoundException('Live activity not found');
    }
    const points = await this.liveRepository.listPoints(activity.id);
    return {
      id: activity.id,
      sport: activity.sport,
      startedAt: new Date(activity.started_at).toISOString(),
      status: activity.status,
      canShare: viewerId === activity.user_id,
      elapsedSeconds: activity.elapsed_seconds,
      distanceMeters: activity.distance_meters,
      lastSequence: activity.last_sequence,
      lastPointAt: activity.last_point_at ? new Date(activity.last_point_at).toISOString() : null,
      lastReceivedAt: activity.last_received_at ? new Date(activity.last_received_at).toISOString() : null,
      route: points.map((point) => [point.longitude, point.latitude] as [number, number]),
    };
  }

  private hashToken(token: string) {
    return this.cryptoRepository.sha256(token);
  }
}
