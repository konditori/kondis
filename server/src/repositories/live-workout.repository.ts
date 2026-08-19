import { Inject, Injectable } from '@nestjs/common';
import { KondisDatabase, KYSELY } from 'src/db/database';
import { LiveWorkoutStatus } from 'src/schema/tables/live-workout.table';
import { ActivityType } from 'src/types';

type LivePointInput = {
  sequence: number;
  recordedAt: Date;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracyMeters: number;
};

@Injectable()
export class LiveWorkoutRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  getById(id: string, userId?: string) {
    return this.db
      .selectFrom('live_workout')
      .selectAll()
      .where('id', '=', id)
      .$if(!!userId, (query) => query.where('user_id', '=', userId!))
      .executeTakeFirst();
  }

  getByClientSessionId(userId: string, clientSessionId: string) {
    return this.db
      .selectFrom('live_workout')
      .selectAll()
      .where('user_id', '=', userId)
      .where('client_session_id', '=', clientSessionId)
      .executeTakeFirst();
  }

  listActive(userId: string) {
    return this.db
      .selectFrom('live_workout')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', 'in', ['recording', 'paused'])
      .orderBy('started_at', 'desc')
      .execute();
  }

  listActiveVisible(userId: string) {
    return this.db
      .selectFrom('live_workout')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', 'in', ['recording', 'paused'])
      .orderBy('started_at', 'desc')
      .execute();
  }

  getByShareTokenHash(hash: string) {
    return this.db
      .selectFrom('live_workout')
      .selectAll()
      .where('share_token_hash', '=', hash)
      .where('status', 'in', ['recording', 'paused', 'ended'])
      .where('share_expires_at', '>', new Date())
      .executeTakeFirst();
  }

  create(input: { userId: string; clientSessionId: string; sport: ActivityType; startedAt: Date }) {
    return this.db
      .insertInto('live_workout')
      .values({
        user_id: input.userId,
        client_session_id: input.clientSessionId,
        sport: input.sport,
        started_at: input.startedAt,
        status: 'recording',
        elapsed_seconds: 0,
        distance_meters: 0,
        last_sequence: 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async appendPoints(id: string, points: LivePointInput[]): Promise<void> {
    await this.db.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('live_workout_point')
        .values(
          points.map((point) => ({
            live_workout_id: id,
            sequence: point.sequence,
            recorded_at: point.recordedAt,
            latitude: point.latitude,
            longitude: point.longitude,
            altitude: point.altitude,
            accuracy_meters: point.accuracyMeters,
          })),
        )
        .onConflict((conflict) => conflict.doNothing())
        .execute();
      const last = await transaction
        .selectFrom('live_workout_point')
        .select(['sequence', 'recorded_at'])
        .where('live_workout_id', '=', id)
        .orderBy('sequence', 'desc')
        .executeTakeFirst();
      if (last) {
        await transaction
          .updateTable('live_workout')
          .set({ last_sequence: last.sequence, last_point_at: last.recorded_at, last_received_at: new Date() })
          .where('id', '=', id)
          .execute();
      }
    });
  }

  updateProgress(id: string, status: LiveWorkoutStatus, elapsedSeconds: number, distanceMeters: number) {
    return this.db
      .updateTable('live_workout')
      .set({ status, elapsed_seconds: elapsedSeconds, distance_meters: distanceMeters, last_received_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  }

  setShareToken(id: string, tokenHash: string, expiresAt: Date) {
    return this.db
      .updateTable('live_workout')
      .set({ share_token_hash: tokenHash, share_expires_at: expiresAt })
      .where('id', '=', id)
      .execute();
  }

  clearShareToken(id: string) {
    return this.db
      .updateTable('live_workout')
      .set({ share_token_hash: null, share_expires_at: null })
      .where('id', '=', id)
      .execute();
  }

  listPoints(id: string, afterSequence = 0) {
    return this.db
      .selectFrom('live_workout_point')
      .selectAll()
      .where('live_workout_id', '=', id)
      .where('sequence', '>', afterSequence)
      .orderBy('sequence', 'asc')
      .execute();
  }
}
