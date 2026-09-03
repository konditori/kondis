import type { AuthenticatedUser } from 'src/auth';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import type { ActivityMetrics, ActivityStreamInput, ActivityType } from 'src/types';
import type { BufferedUploadedFileData } from 'src/types/uploads';

import type { KondisDatabase } from 'src/db/database';

export const makeUploadedFile = (filename: string, buffer: Buffer): BufferedUploadedFileData => ({
  originalname: filename,
  buffer,
  size: buffer.length,
});

type UserOverrides = Partial<{
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  role: 'admin' | 'user';
}>;

const defaultMetrics: ActivityMetrics = {
  elapsed_time: 3600,
  moving_time: 3500,
  distance: 10_000,
  elevation_gain: 100,
  elevation_loss: 100,
  avg_speed: 2.8,
  max_speed: 4.9,
  avg_hr: 150,
  max_hr: 175,
  avg_cadence: 168,
  max_cadence: 190,
  avg_power: 210,
  max_power: 420,
  normalized_power: 230,
  calories: 700,
};

export const createMediumFactory = (db: KondisDatabase) => {
  const users = new UserRepository(db);
  const uploads = new UploadRepository(db);
  const activities = new ActivityRepository(db);

  const newUser = async (overrides: UserOverrides = {}): Promise<AuthenticatedUser> => {
    const user = await users.create({
      email: `medium-test-${crypto.randomUUID()}@example.com`,
      first_name: 'Medium Test',
      last_name: 'User',
      password_hash: 'not-a-real-password-hash',
      role: 'user',
      ...overrides,
    });

    return {
      id: user.id,
      role: user.role,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    };
  };

  const newActivity = async (
    userId: string,
    startedAt: Date,
    name: string,
    streams: ActivityStreamInput[] = [],
    metrics: Partial<ActivityMetrics> | null = {},
    sport: ActivityType = 'run',
  ): Promise<string> => {
    const upload = await uploads.create({
      checksum: crypto.randomUUID().replaceAll('-', ''),
      original_name: `${name}.fit`,
      byte_size: 1,
      storage_path: `seed/${name}.fit`,
      user_id: userId,
    });

    const id = await activities.create({
      activity: {
        upload_id: upload.id,
        sport,
        name,
        started_at: startedAt,
        timezone_offset_minutes: 0,
        user_id: userId,
      },
      streams,
      laps: [],
    });
    if (metrics) {
      await activities.setMetrics(id, { ...defaultMetrics, ...metrics });
      await activities.recomputeBestEfforts(id);
      await activities.recomputeRouteMatches(id);
      await activities.refreshBestEffortRankings();
    }
    return id;
  };

  const newPendingActivity = (userId: string) =>
    newActivity(userId, new Date('2024-01-01T08:00:00.000Z'), 'pending', [], null);

  return { newUser, newActivity, newPendingActivity };
};
