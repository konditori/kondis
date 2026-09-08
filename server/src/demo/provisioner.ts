import { sql } from 'kysely';

import { DEMO_FIT_SPECS, createDemoFitFile } from 'src/demo/fit';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import type { KondisDatabase, KondisExecutor } from 'src/types';
import { parseFitMessages } from 'src/utils/fit';

export const DEMO_USER_EMAIL = 'demo@kondis.org';
const DEMO_PASSWORD_HASH = '$2b$12$q5KRFbq3UirFSlEhM7Xa.uoi96PRJvpMz4b6UPvN4clsmqB0VxfGW';
const DEMO_IMAGE_MIME_TYPE = 'image/jpeg';

type DemoImageMetadata = {
  storagePath: string;
  byteSize: number;
  width: number;
  height: number;
};

const DEMO_ACTIVITY_IMAGE_METADATA: Record<string, DemoImageMetadata> = {
  'golden-hour-trail': {
    storagePath: 'activities/golden-hour-trail/1.jpg',
    byteSize: 560293,
    width: 1280,
    height: 960,
  },
  'city-tempo': {
    storagePath: 'activities/city-tempo/1.jpg',
    byteSize: 1520692,
    width: 4618,
    height: 2520,
  },
  'island-ride': {
    storagePath: 'activities/island-ride/1.jpg',
    byteSize: 216933,
    width: 1280,
    height: 960,
  },
  'gravel-after-work': {
    storagePath: 'activities/gravel-after-work/1.jpg',
    byteSize: 2059494,
    width: 1920,
    height: 2560,
  },
  'long-sunday-run': {
    storagePath: 'activities/long-sunday-run/1.jpg',
    byteSize: 1144101,
    width: 1920,
    height: 1445,
  },
  'park-walk': {
    storagePath: 'activities/park-walk/1.jpg',
    byteSize: 940971,
    width: 1920,
    height: 1280,
  },
  'golden-gate-intervals': {
    storagePath: 'activities/golden-gate-intervals/1.jpg',
    byteSize: 2564675,
    width: 3072,
    height: 2048,
  },
  'central-park-progression': {
    storagePath: 'activities/central-park-progression/1.jpg',
    byteSize: 923542,
    width: 1920,
    height: 1342,
  },
  'seawall-sunrise-ride': {
    storagePath: 'activities/seawall-sunrise-ride/1.jpg',
    byteSize: 563279,
    width: 1920,
    height: 886,
  },
  'wildwood-climb': {
    storagePath: 'activities/wildwood-climb/1.jpg',
    byteSize: 2231744,
    width: 1536,
    height: 2560,
  },
  'thames-evening-ride': {
    storagePath: 'activities/thames-evening-ride/1.jpg',
    byteSize: 543441,
    width: 1800,
    height: 1194,
  },
  'canal-recovery-spin': {
    storagePath: 'activities/canal-recovery-spin/1.jpg',
    byteSize: 356893,
    width: 1280,
    height: 853,
  },
};

const demoFixtureId = (kind: number, index: number): string =>
  `00000000-0000-4000-8000-${String(kind * 100 + index + 1).padStart(12, '0')}`;

const DEMO_USER_CONFIGS = [
  {
    id: demoFixtureId(1, 0),
    email: DEMO_USER_EMAIL,
    role: 'admin',
    first_name: 'John',
    last_name: 'Doe',
    avatar_path: 'avatars/john-doe.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 144935,
  },
  {
    id: demoFixtureId(1, 1),
    email: 'sofia@kondis.org',
    role: 'user',
    first_name: 'Sofia',
    last_name: 'Berg',
    avatar_path: 'avatars/sofia-berg.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 168522,
  },
  {
    id: demoFixtureId(1, 2),
    email: 'marcus@kondis.org',
    role: 'user',
    first_name: 'Marcus',
    last_name: 'Lee',
    avatar_path: 'avatars/marcus-lee.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 100841,
  },
] as const;

type DemoCommentConfig = {
  userEmail: string;
  body: string;
};

const DEMO_ACTIVITY_COMMENTS: Record<string, readonly DemoCommentConfig[]> = {
  'golden-hour-trail': [
    {
      userEmail: 'sofia@kondis.org',
      body: 'That light is worth the early alarm. The loop looks perfect.',
    },
    {
      userEmail: DEMO_USER_EMAIL,
      body: 'It really was. The legs felt better than expected too.',
    },
  ],
  'city-tempo': [
    {
      userEmail: 'marcus@kondis.org',
      body: 'The middle three kilometres look properly spicy. Nice pacing.',
    },
  ],
  'island-ride': [
    {
      userEmail: DEMO_USER_EMAIL,
      body: 'Cold hands, warm sunset. That is a pretty good trade.',
    },
  ],
  'gravel-after-work': [
    {
      userEmail: 'sofia@kondis.org',
      body: 'Did the final climb feel as fast as it looks?',
    },
    {
      userEmail: DEMO_USER_EMAIL,
      body: 'Somehow, yes. The dusty descent made up for the first half.',
    },
  ],
  'long-sunday-run': [
    {
      userEmail: 'marcus@kondis.org',
      body: 'This is exactly the kind of run that makes Monday feel easier.',
    },
  ],
  'park-walk': [
    {
      userEmail: DEMO_USER_EMAIL,
      body: 'A very good choice after a long day. The park looks peaceful.',
    },
  ],
  'golden-gate-intervals': [
    {
      userEmail: 'sofia@kondis.org',
      body: 'Short and sharp is right. Those efforts add up quickly.',
    },
  ],
  'central-park-progression': [
    {
      userEmail: 'marcus@kondis.org',
      body: 'The best kind of progression: relaxed enough at the start to enjoy it.',
    },
  ],
  'seawall-sunrise-ride': [
    {
      userEmail: DEMO_USER_EMAIL,
      body: 'That is a beautiful way to start the day. Smooth route, too.',
    },
  ],
  'wildwood-climb': [
    {
      userEmail: 'sofia@kondis.org',
      body: 'Muddy shoes and a fast descent is a solid day out.',
    },
  ],
  'thames-evening-ride': [
    {
      userEmail: 'marcus@kondis.org',
      body: 'The river light must have been excellent on this one.',
    },
  ],
  'canal-recovery-spin': [
    {
      userEmail: DEMO_USER_EMAIL,
      body: 'Exactly the right amount of effort for a recovery day.',
    },
  ],
};

export type DemoProvisioningDependencies = {
  database: KondisDatabase;
  activities: ActivityRepository;
  images: ActivityImageRepository;
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
  uploadId: string;
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
  index: number,
): Promise<string> => {
  const bytes = createDemoFitFile(spec);
  const parsed = parseFitMessages(dependencies.fit.decode(bytes));
  const upload = await dependencies.uploads.create(
    {
      id: demoFixtureId(2, index),
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
        id: demoFixtureId(3, index),
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

export const getDemoUser = async (database: KondisDatabase) => {
  const user = await database
    .selectFrom('user')
    .select(['id', 'email', 'role', 'first_name', 'last_name'])
    .where('email', '=', DEMO_USER_EMAIL)
    .executeTakeFirst();
  if (!user) {
    throw new Error(`Demo database is not seeded; expected ${DEMO_USER_EMAIL}`);
  }
  return asAuthenticatedUser(user);
};

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
      .values({
        ...config,
        password_hash: DEMO_PASSWORD_HASH,
      })
      .returning(['id', 'email', 'role', 'first_name', 'last_name'])
      .executeTakeFirstOrThrow();
    usersByEmail.set(user.email, user);
  }

  return DEMO_USER_CONFIGS.map(({ email }) => usersByEmail.get(email)!);
};

const seedDemoImages = async (
  executor: KondisExecutor,
  dependencies: DemoProvisioningDependencies,
  activities: readonly DemoActivity[],
): Promise<void> => {
  for (const activity of activities) {
    const metadata = DEMO_ACTIVITY_IMAGE_METADATA[activity.spec.slug];
    if (!metadata) {
      throw new Error(`Missing demo image metadata for ${activity.spec.slug}`);
    }
    const checksum = `demo-image-v1:${activity.spec.slug}`;
    const image =
      (await dependencies.images.getByUploadChecksum(activity.uploadId, checksum, executor)) ??
      (await dependencies.images.create(
        {
          id: demoFixtureId(4, DEMO_FIT_SPECS.indexOf(activity.spec)),
          upload_id: activity.uploadId,
          checksum,
          original_name: `${activity.spec.slug}.jpg`,
          sort_order: 0,
          mime_type: DEMO_IMAGE_MIME_TYPE,
          byte_size: metadata.byteSize,
          width: metadata.width,
          height: metadata.height,
          status: 'ready',
        },
        executor,
      ));

    await dependencies.images.upsertFile(
      {
        image_id: image.id,
        variant: 'preview',
        storage_path: metadata.storagePath,
        mime_type: DEMO_IMAGE_MIME_TYPE,
        byte_size: metadata.byteSize,
        width: metadata.width,
        height: metadata.height,
      },
      executor,
    );
  }
};

const seedActivityForUser = async (
  executor: KondisExecutor,
  dependencies: DemoProvisioningDependencies,
  owner: DemoUser,
  spec: (typeof DEMO_FIT_SPECS)[number],
  index: number,
): Promise<string> => seedActivity(executor, dependencies, owner, spec, index);

const seedSocialData = async (
  executor: KondisExecutor,
  users: readonly DemoUser[],
  activities: readonly DemoActivity[],
) => {
  const usersByEmail = new Map(users.map((user) => [user.email, user]));
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
    }

    const comments = DEMO_ACTIVITY_COMMENTS[activity.spec.slug];
    if (!comments) {
      throw new Error(`Missing demo comments for ${activity.spec.slug}`);
    }
    for (const [commentIndex, comment] of comments.entries()) {
      const actor = usersByEmail.get(comment.userEmail);
      if (!actor) {
        throw new Error(`Missing demo comment user ${comment.userEmail}`);
      }
      const createdAt = new Date(new Date(activity.spec.startedAt).getTime() + (commentIndex + 1) * 60 * 60 * 1000);
      await executor
        .insertInto('activity_comment')
        .values({
          activity_id: activity.id,
          user_id: actor.id,
          body: comment.body,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .executeTakeFirstOrThrow();
      if (actor.id !== activity.owner.id) {
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
    const existingActivities =
      existingUploads.length > 0
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
      activities.push({
        id: await seedActivityForUser(transaction, dependencies, owner, spec, index),
        uploadId: demoFixtureId(2, index),
        owner,
        spec,
      });
    }
    await seedDemoImages(transaction, dependencies, activities);
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
