import { LiveActivityStatus, type ActivityType } from 'src/enum';
import type { LiveActivityTable } from 'src/schema/tables/live-activity.table';
import type { KondisDatabase } from 'src/types';

type LivePointInput = {
  sequence: number;
  recordedAt: Date;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracyMeters: number;
};

export class LiveActivityRepository {
  constructor(private readonly db: KondisDatabase) {}

  getById(id: string, userId?: string) {
    return this.db
      .selectFrom('live_activity')
      .selectAll()
      .where('id', '=', id)
      .$if(!!userId, (query) => query.where('user_id', '=', userId!))
      .executeTakeFirst();
  }

  getByClientSessionId(userId: string, clientSessionId: string) {
    return this.db
      .selectFrom('live_activity')
      .selectAll()
      .where('user_id', '=', userId)
      .where('client_session_id', '=', clientSessionId)
      .executeTakeFirst();
  }

  listActive(userId: string) {
    return this.db
      .selectFrom('live_activity')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', 'in', [LiveActivityStatus.Recording, LiveActivityStatus.Paused])
      .orderBy('started_at', 'desc')
      .execute();
  }

  listActiveVisible(userId: string) {
    return this.db
      .selectFrom('live_activity')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', 'in', [LiveActivityStatus.Recording, LiveActivityStatus.Paused])
      .orderBy('started_at', 'desc')
      .execute();
  }

  getByShareTokenHash(hash: string) {
    return this.db
      .selectFrom('live_activity')
      .selectAll()
      .where('share_token_hash', '=', hash)
      .where('status', 'in', [LiveActivityStatus.Recording, LiveActivityStatus.Paused, LiveActivityStatus.Ended])
      .where('share_expires_at', '>', new Date())
      .executeTakeFirst();
  }

  create(input: { userId: string; clientSessionId: string; sport: ActivityType; startedAt: Date }) {
    return this.db
      .insertInto('live_activity')
      .values({
        user_id: input.userId,
        client_session_id: input.clientSessionId,
        sport: input.sport,
        started_at: input.startedAt,
        status: LiveActivityStatus.Recording,
        elapsed_seconds: 0,
        distance_meters: 0,
        last_sequence: 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  deleteById(id: string, userId: string) {
    return this.db.deleteFrom('live_activity').where('id', '=', id).where('user_id', '=', userId).execute();
  }

  deleteOtherSessions(userId: string, clientSessionId: string) {
    return this.db
      .deleteFrom('live_activity')
      .where('user_id', '=', userId)
      .where('client_session_id', '!=', clientSessionId)
      .execute();
  }

  async appendPoints(id: string, points: LivePointInput[]): Promise<void> {
    await this.db.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('live_activity_point')
        .values(
          points.map((point) => ({
            live_activity_id: id,
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
        .selectFrom('live_activity_point')
        .select(['sequence', 'recorded_at'])
        .where('live_activity_id', '=', id)
        .orderBy('sequence', 'desc')
        .executeTakeFirst();
      if (last) {
        await transaction
          .updateTable('live_activity')
          .set({ last_sequence: last.sequence, last_point_at: last.recorded_at, last_received_at: new Date() })
          .where('id', '=', id)
          .execute();
      }
    });
  }

  updateProgress(id: string, status: LiveActivityTable['status'], elapsedSeconds: number, distanceMeters: number) {
    return this.db
      .updateTable('live_activity')
      .set({ status, elapsed_seconds: elapsedSeconds, distance_meters: distanceMeters, last_received_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  }

  setShareToken(id: string, tokenHash: string, expiresAt: Date) {
    return this.db
      .updateTable('live_activity')
      .set({ share_token_hash: tokenHash, share_expires_at: expiresAt })
      .where('id', '=', id)
      .execute();
  }

  clearShareToken(id: string) {
    return this.db
      .updateTable('live_activity')
      .set({ share_token_hash: null, share_expires_at: null })
      .where('id', '=', id)
      .execute();
  }

  listPoints(id: string, afterSequence = 0) {
    return this.db
      .selectFrom('live_activity_point')
      .selectAll()
      .where('live_activity_id', '=', id)
      .where('sequence', '>', afterSequence)
      .orderBy('sequence', 'asc')
      .execute();
  }
}
