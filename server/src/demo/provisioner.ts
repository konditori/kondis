import { sql } from 'kysely';

import {
  createDemoActivityData,
  DEMO_ACTIVITY_COMMENTS,
  DEMO_FIT_SPECS,
  DEMO_IMAGE_MIME_TYPE,
  DEMO_PASSWORD_HASH,
  DEMO_SESSION_ID,
  DEMO_SESSION_TOKEN_HASH,
  DEMO_USER_CONFIGS,
  demoFixtureId,
  JOHN_EMAIL,
} from 'src/demo/demo-data';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import type { KondisDatabase, KondisExecutor } from 'src/types';

export { DEMO_SESSION_ID } from 'src/demo/demo-data';

export type DemoImageMetadata = {
  originalName: string;
  storagePath: string;
  byteSize: number;
  width: number;
  height: number;
};

export type DemoProvisioningDependencies = {
  database: KondisDatabase;
  activities: ActivityRepository;
  imageMetadata: Readonly<Record<string, readonly DemoImageMetadata[]>>;
  images: ActivityImageRepository;
  uploads: UploadRepository;
  social: SocialRepository;
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

const seedActivity = async (
  executor: KondisExecutor,
  dependencies: DemoProvisioningDependencies,
  user: DemoUser,
  spec: (typeof DEMO_FIT_SPECS)[number],
  index: number,
): Promise<string> => {
  const data = createDemoActivityData(spec);
  const upload = await dependencies.uploads.create(
    {
      id: demoFixtureId(2, index),
      checksum: `demo-activity-v1:${spec.slug}`,
      original_name: `${spec.slug}.activity.json`,
      byte_size: 0,
      storage_path: '',
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
        started_at: new Date(spec.startedAt),
        timezone_offset_minutes: 120,
      },
      streams: data.streams,
      laps: data.laps,
    },
    executor,
  );
  await dependencies.activities.setMetrics(activityId, data.metrics, executor);
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
    .where('email', '=', JOHN_EMAIL)
    .executeTakeFirst();
  if (!user) {
    throw new Error(`Demo database is not seeded; expected ${JOHN_EMAIL}`);
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

const seedDemoSession = async (executor: KondisExecutor, userId: string): Promise<void> => {
  const existing = await executor
    .selectFrom('auth_session')
    .select('id')
    .where('id', '=', DEMO_SESSION_ID)
    .executeTakeFirst();
  if (existing) {
    return;
  }
  await executor
    .insertInto('auth_session')
    .values({
      id: DEMO_SESSION_ID,
      user_id: userId,
      token_hash: DEMO_SESSION_TOKEN_HASH,
      expires_at: new Date('2099-01-01T00:00:00.000Z'),
    })
    .execute();
};

const seedDemoImages = async (
  executor: KondisExecutor,
  dependencies: DemoProvisioningDependencies,
  activities: readonly DemoActivity[],
): Promise<void> => {
  for (const activity of activities) {
    const imageMetadata = dependencies.imageMetadata[activity.spec.slug];
    if (!imageMetadata) {
      throw new Error(`Missing demo image metadata for ${activity.spec.slug}`);
    }
    const activityIndex = DEMO_FIT_SPECS.indexOf(activity.spec);
    for (const [imageIndex, metadata] of imageMetadata.entries()) {
      const checksum =
        imageIndex === 0
          ? `demo-image-v1:${activity.spec.slug}`
          : `demo-image-v1:${activity.spec.slug}:${imageIndex + 1}`;
      const image =
        (await dependencies.images.getByUploadChecksum(activity.uploadId, checksum, executor)) ??
        (await dependencies.images.create(
          {
            id: demoFixtureId(4, activityIndex + imageIndex * DEMO_FIT_SPECS.length),
            upload_id: activity.uploadId,
            checksum,
            original_name: metadata.originalName,
            sort_order: imageIndex,
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
  dependencies: DemoProvisioningDependencies,
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
      await dependencies.social.createComment(
        {
          activity_id: activity.id,
          user_id: actor.id,
          body: comment.body,
          created_at: createdAt,
          updated_at: createdAt,
        },
        executor,
      );
    }
  }
};

const provisionDemoDataOnce = async (dependencies: DemoProvisioningDependencies) => {
  const provisioning = await dependencies.database.transaction().execute(async (transaction) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext('kondis:demo-provisioning'))`.execute(transaction);
    await transaction.deleteFrom('notification').execute();
    const users = await createDemoUsers(transaction);
    await seedDemoSession(transaction, users[0].id);
    const existingUploads = await transaction
      .selectFrom('upload')
      .select('id')
      .where('checksum', 'like', 'demo-activity-v1:%')
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
    await seedSocialData(transaction, dependencies, users, activities);
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
