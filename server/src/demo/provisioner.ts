import { sql } from 'kysely';

import { DEMO_FIT_SPECS, createDemoFitFile } from 'src/demo/fit';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import type { KondisDatabase, KondisExecutor } from 'src/types';
import { parseFitMessages } from 'src/utils/fit';

export const DEMO_USER_EMAIL = 'demo@kondis.org';
const DEMO_PASSWORD_HASH = '$2b$12$q5KRFbq3UirFSlEhM7Xa.uoi96PRJvpMz4b6UPvN4clsmqB0VxfGW';

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
        // FIT has no gravel-specific sport enum; retain the curated subtype after parsing the FIT payload.
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

export const provisionDemoData = async (dependencies: DemoProvisioningDependencies) => {
  const provisioning = await dependencies.database.transaction().execute(async (transaction) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext('kondis:demo-provisioning'))`.execute(transaction);
    const users = await transaction.selectFrom('user').selectAll().forUpdate().execute();
    if (users.length > 1) {
      throw new Error(`Demo mode requires exactly one provisioned user; found ${users.length}`);
    }

    const user =
      users[0] ??
      (await transaction
        .insertInto('user')
        .values({
          email: DEMO_USER_EMAIL,
          first_name: 'Demo',
          last_name: 'Athlete',
          password_hash: DEMO_PASSWORD_HASH,
          role: 'admin',
        })
        .returningAll()
        .executeTakeFirstOrThrow());

    const existingActivities = await transaction
      .selectFrom('activity')
      .select('id')
      .where('user_id', '=', user.id)
      .execute();
    if (existingActivities.length > 0) {
      return {
        user: asAuthenticatedUser(user),
        activityIds: existingActivities.map(({ id }) => id),
        seeded: false,
      };
    }

    const activityIds = [];
    for (const spec of DEMO_FIT_SPECS) {
      activityIds.push(await seedActivity(transaction, dependencies, user, spec));
    }
    return { user: asAuthenticatedUser(user), activityIds, seeded: true };
  });

  // Best-effort and route matching use their own transactions. They run after the seed transaction has committed,
  // and the lock above makes the first-request path safe when multiple isolates initialize the demo concurrently.
  let rankingsNeedRefresh = provisioning.seeded;
  for (const activityId of provisioning.activityIds) {
    const activity = await dependencies.activities.getById(activityId);
    if (!activity) {
      continue;
    }
    if (activity.best_efforts_computed_at === null) {
      await dependencies.activities.recomputeBestEfforts(activityId);
      rankingsNeedRefresh = true;
    }
    if (activity.route_matches_computed_at === null) {
      await dependencies.activities.recomputeRouteMatches(activityId);
    }
  }
  if (rankingsNeedRefresh) {
    await dependencies.activities.refreshBestEffortRankings();
  }
  return provisioning.user;
};
