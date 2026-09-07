import { sql } from 'kysely';

import { DEMO_FIT_SPECS, createDemoFitFile } from 'src/demo/fit';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import type { KondisDatabase, KondisExecutor } from 'src/types';
import { parseFitMessages } from 'src/utils/fit';

export const DEMO_USER_EMAIL = 'demo@kondis.org';
const DEMO_PASSWORD_HASH = '$2b$12$q5KRFbq3UirFSlEhM7Xa.uoi96PRJvpMz4b6UPvN4clsmqB0VxfGW';

const DEMO_USER_CONFIGS = [
  {
    email: DEMO_USER_EMAIL,
    role: 'admin',
    first_name: 'John',
    last_name: 'Doe',
  },
  {
    email: 'sofia@kondis.org',
    role: 'user',
    first_name: 'Sofia',
    last_name: 'Berg',
  },
  {
    email: 'marcus@kondis.org',
    role: 'user',
    first_name: 'Marcus',
    last_name: 'Lee',
  },
] as const;

export type DemoProvisioningDependencies = {
  database: KondisDatabase;
  activities: ActivityRepository;
  uploads: UploadRepository;
  fit: FitRepository;
};

type DemoUser = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  first_name: string;
  last_name: string;
};

type DemoActivity = {
  id: string;
  owner: DemoUser;
  spec: (typeof DEMO_FIT_SPECS)[number];
};

const toLapInput = (lap: ReturnType<typeof parseFitMessages>['laps'][number]) => ({
  lap_index: lap.index,
  started_at: lap.startedAt,
  elapsed_time: lap.elapsedTimeS,
  moving_time: lap.movingTimeS,
  distance: lap.distanceM,
  avg_hr: lap.avgHr,
  max_hr: lap.maxHr,
  avg_power: lap.avgPower,
  avg_speed_mps: lap.avgSpeedMps,
});

const seedActivity = async (
  executor: KondisExecutor,
  dependencies: DemoProvisioningDependencies,
  user: DemoUser,
  spec: (typeof DEMO_FIT_SPECS)[number],
): Promise<string> => {
  const bytes = createDemoFitFile(spec);
  const parsed = parseFitMessages(dependencies.fit.decode(bytes));
  const upload = await dependencies.uploads.create(
    {
      checksum: `demo-fit-v1:${spec.slug}`,
      original_name: spec.filename,
      byte_size: bytes.byteLength,
      storage_path: `demo/${spec.filename}`,
      user_id: user.id,
      status: 'parsed',
    },
    executor,
  );
  const activityId = await dependencies.activities.create(
    {
      activity: {
        upload_id: upload.id,
        user_id: user.id,
        sport: spec.activitySport,
        name: spec.title,
        description: spec.description,
        tags: spec.tags,
        started_at: parsed.startedAt,
        timezone_offset_minutes: 120,
      },
      streams: parsed.streams,
      laps: parsed.laps.map((lap) => toLapInput(lap)),
    },
    executor,
  );
  await dependencies.activities.setMetrics(
    activityId,
    {
      elapsed_time: parsed.elapsedTime,
      moving_time: parsed.movingTime,
      distance: parsed.distance,
      elevation_gain: parsed.elevationGain,
      elevation_loss: parsed.elevationLoss,
      avg_speed: parsed.avgSpeed,
      max_speed: parsed.maxSpeed,
      avg_hr: parsed.avgHr,
      max_hr: parsed.maxHr,
      avg_cadence: parsed.avgCadence,
      max_cadence: parsed.maxCadence,
      avg_power: parsed.avgPower,
      max_power: parsed.maxPower,
      normalized_power: parsed.normalizedPower,
      calories: parsed.calories,
    },
    executor,
  );
  return activityId;
};

const asAuthenticatedUser = (user: DemoUser) => ({
  id: user.id,
  role: user.role,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
});

const createDemoUsers = async (executor: KondisExecutor): Promise<DemoUser[]> => {
  const existingUsers = await executor
    .selectFrom('user')
    .select(['id', 'email', 'role', 'first_name', 'last_name'])
    .where(
      'email',
      'in',
      DEMO_USER_CONFIGS.map(({ email }) => email),
    )
    .execute();
  const usersByEmail = new Map(existingUsers.map((user) => [user.email, user]));

  for (const config of DEMO_USER_CONFIGS) {
    if (usersByEmail.has(config.email)) {
      continue;
    }
    const user = await executor
      .insertInto('user')
      .values({ ...config, password_hash: DEMO_PASSWORD_HASH })
      .returning(['id', 'email', 'role', 'first_name', 'last_name'])
      .executeTakeFirstOrThrow();
    usersByEmail.set(user.email, user);
  }

  return DEMO_USER_CONFIGS.map(({ email }) => usersByEmail.get(email)!);
};

const seedActivityForUser = async (
  executor: KondisExecutor,
  dependencies: DemoProvisioningDependencies,
  owner: DemoUser,
  spec: (typeof DEMO_FIT_SPECS)[number],
): Promise<string> => seedActivity(executor, dependencies, owner, spec);

const seedSocialData = async (
  executor: KondisExecutor,
  users: readonly DemoUser[],
  activities: readonly DemoActivity[],
) => {
  for (const follower of users) {
    for (const followee of users) {
      if (follower.id === followee.id) {
        continue;
      }
      await executor
        .insertInto('user_follow')
        .values({ follower_id: follower.id, followee_id: followee.id })
        .onConflict((conflict) => conflict.doNothing())
        .execute();
    }
  }

  for (const activity of activities) {
    const ownerIndex = users.findIndex((user) => user.id === activity.owner.id);
    for (let offset = 1; offset < users.length; offset++) {
      const actor = users[(ownerIndex + offset) % users.length];
      await executor.insertInto('activity_like').values({ activity_id: activity.id, user_id: actor.id }).execute();
      await executor
        .insertInto('notification')
        .values({ user_id: activity.owner.id, actor_id: actor.id, type: 'activity_like', activity_id: activity.id })
        .execute();

      const body = `${actor.first_name} loved your ${activity.spec.title.toLowerCase()} — great work!`;
      await executor
        .insertInto('activity_comment')
        .values({ activity_id: activity.id, user_id: actor.id, body })
        .executeTakeFirstOrThrow();
      await executor
        .insertInto('notification')
        .values({
          user_id: activity.owner.id,
          actor_id: actor.id,
          type: 'activity_comment',
          activity_id: activity.id,
        })
        .execute();
    }
  }
};

const provisionDemoDataOnce = async (dependencies: DemoProvisioningDependencies) => {
  const provisioning = await dependencies.database.transaction().execute(async (transaction) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext('kondis:demo-provisioning'))`.execute(transaction);
    const users = await createDemoUsers(transaction);
    const existingUploads = await transaction
      .selectFrom('upload')
      .select('id')
      .where('checksum', 'like', 'demo-fit-v1:%')
      .execute();
    const existingActivities = existingUploads.length
      ? await transaction
          .selectFrom('activity')
          .select('id')
          .where(
            'upload_id',
            'in',
            existingUploads.map(({ id }) => id),
          )
          .execute()
      : [];
    if (existingActivities.length === DEMO_FIT_SPECS.length) {
      return {
        user: asAuthenticatedUser(users[0]),
        activityIds: existingActivities.map(({ id }) => id),
      };
    }

    const activities: DemoActivity[] = [];
    for (const [index, spec] of DEMO_FIT_SPECS.entries()) {
      const owner = users[index % users.length];
      activities.push({ id: await seedActivityForUser(transaction, dependencies, owner, spec), owner, spec });
    }
    await seedSocialData(transaction, users, activities);
    return {
      user: asAuthenticatedUser(users[0]),
      activityIds: activities.map(({ id }) => id),
    };
  });

  for (const activityId of provisioning.activityIds) {
    const activity = await dependencies.activities.getById(activityId);
    if (!activity) {
      continue;
    }
    if (activity.best_efforts_computed_at === null) {
      await dependencies.activities.recomputeBestEfforts(activityId);
    }
    if (activity.route_matches_computed_at === null) {
      await dependencies.activities.recomputeRouteMatches(activityId);
    }
  }
  await dependencies.activities.refreshBestEffortRankings();
  return provisioning.user;
};

export const provisionDemoData = provisionDemoDataOnce;
