import { NotFoundException } from 'src/errors';
import type { CryptoPort } from 'src/ports/crypto.port';
import { LiveWorkoutRepository } from 'src/repositories/live-workout.repository';
import { LiveWorkoutStatus } from 'src/schema/tables/live-workout.table';
import type { ActivityType } from 'src/types';

type PointInput = {
  sequence: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracyMeters: number;
};
const SHARE_LIFETIME_MS = 24 * 60 * 60 * 1000;

export class LiveWorkoutService {
  constructor(
    private readonly repository: LiveWorkoutRepository,
    private readonly crypto: CryptoPort,
  ) {}

  async create(userId: string, input: { clientSessionId: string; sport: ActivityType; startedAt: string }) {
    const existing = await this.repository.getByClientSessionId(userId, input.clientSessionId);
    const workout =
      existing ??
      (await this.repository.create({
        userId,
        clientSessionId: input.clientSessionId,
        sport: input.sport,
        startedAt: new Date(input.startedAt),
      }));
    return this.toDto(workout, userId);
  }

  async list(userId: string) {
    const workouts = await this.repository.listActiveVisible(userId);
    return Promise.all(workouts.map((workout) => this.toDto(workout, userId)));
  }

  async get(id: string, userId: string) {
    const workout = await this.repository.getById(id, userId);
    if (!workout) {
      throw new NotFoundException('Live workout not found');
    }
    return this.toDto(workout, userId);
  }

  async getShared(token: string) {
    const workout = await this.repository.getByShareTokenHash(this.hashToken(token));
    if (!workout) {
      throw new NotFoundException('This live tracking link has expired or was revoked');
    }
    return this.toDto(workout);
  }

  async appendPoints(
    id: string,
    userId: string,
    input: { points: PointInput[]; elapsedSeconds: number; distanceMeters: number },
  ) {
    const workout = await this.repository.getById(id, userId);
    if (!workout) {
      throw new NotFoundException('Live workout not found');
    }
    if (workout.status === 'ended' || workout.status === 'discarded') {
      return { id: workout.id, lastSequence: workout.last_sequence };
    }
    await this.repository.appendPoints(
      id,
      input.points.map((point) => ({
        ...point,
        altitude: point.altitude ?? null,
        recordedAt: new Date(point.recordedAt),
      })),
    );
    const updated = await this.repository.updateProgress(
      id,
      workout.status,
      input.elapsedSeconds,
      input.distanceMeters,
    );
    const acknowledged = updated ?? workout;
    return { id: acknowledged.id, lastSequence: acknowledged.last_sequence };
  }

  async updateState(
    id: string,
    userId: string,
    input: { status: Exclude<LiveWorkoutStatus, 'discarded'>; elapsedSeconds: number; distanceMeters: number },
  ) {
    const workout = await this.repository.getById(id, userId);
    if (!workout) {
      throw new NotFoundException('Live workout not found');
    }
    if (workout.status === 'discarded') {
      return this.toDto(workout, userId);
    }
    const updated = await this.repository.updateProgress(id, input.status, input.elapsedSeconds, input.distanceMeters);
    return this.toDto(updated ?? workout, userId);
  }

  async createShare(id: string, userId: string) {
    const workout = await this.repository.getById(id, userId);
    if (!workout) {
      throw new NotFoundException('Live workout not found');
    }
    const token = this.crypto.randomToken(24);
    const expiresAt = new Date(Date.now() + SHARE_LIFETIME_MS);
    await this.repository.setShareToken(id, this.hashToken(token), expiresAt);
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async revokeShare(id: string, userId: string): Promise<void> {
    const workout = await this.repository.getById(id, userId);
    if (!workout) {
      throw new NotFoundException('Live workout not found');
    }
    await this.repository.clearShareToken(id);
  }

  async discard(id: string, userId: string): Promise<void> {
    const workout = await this.repository.getById(id, userId);
    if (!workout) {
      throw new NotFoundException('Live workout not found');
    }
    await this.repository.clearShareToken(id);
    await this.repository.updateProgress(id, 'discarded', workout.elapsed_seconds, workout.distance_meters);
  }

  private async toDto(workout: Awaited<ReturnType<LiveWorkoutRepository['getById']>> & {}, viewerId?: string) {
    if (!workout) {
      throw new NotFoundException('Live workout not found');
    }
    const points = await this.repository.listPoints(workout.id);
    return {
      id: workout.id,
      sport: workout.sport,
      startedAt: new Date(workout.started_at).toISOString(),
      status: workout.status,
      canShare: viewerId === workout.user_id,
      elapsedSeconds: workout.elapsed_seconds,
      distanceMeters: workout.distance_meters,
      lastSequence: workout.last_sequence,
      lastPointAt: workout.last_point_at ? new Date(workout.last_point_at).toISOString() : null,
      lastReceivedAt: workout.last_received_at ? new Date(workout.last_received_at).toISOString() : null,
      route: points.map((point) => [point.longitude, point.latitude] as [number, number]),
    };
  }

  private hashToken(token: string) {
    return this.crypto.sha256(token);
  }
}
