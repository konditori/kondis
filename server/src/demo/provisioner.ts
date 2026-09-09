import { sql } from 'kysely';

import { insertBackgroundJobs } from 'src/cloudflare/background-job';
import {
  DEMO_ACTIVITY_COMMENTS,
  DEMO_FIT_SPECS,
  DEMO_IMAGE_MIME_TYPE,
  DEMO_PASSWORD_HASH,
  DEMO_SESSION_TOKEN_HASH,
  demoFixtureId,
  JOHN_EMAIL,
  SESSION_ID,
  USERS,
} from 'src/demo/data';
import { JobName } from 'src/enum';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import type { ActivityStreamInput, KondisDatabase, KondisExecutor } from 'src/types';
import type { JobItem } from 'src/types/jobs';
import { haversineDistance } from 'src/utils/geo';

export { SESSION_ID as DEMO_SESSION_ID } from 'src/demo/data';

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

type DemoActivityData = {
  streams: ActivityStreamInput[];
  laps: {
    lap_index: number;
    started_at: Date;
    elapsed_time: number;
    moving_time: number;
    distance: number;
    avg_hr: number;
    max_hr: number;
    avg_power: number;
    avg_speed_mps: number;
  }[];
};

const demoActivityProgress = (ratio: number): number => {
  const variation = Math.sin(ratio * Math.PI * 5) * 0.012 + Math.sin(ratio * Math.PI * 13) * 0.004;
  return Math.min(1, Math.max(0, ratio + variation * ratio * (1 - ratio)));
};

const interpolateDemoRoute = (route: (typeof DEMO_FIT_SPECS)[number]['route'], ratio: number) => {
  const distances = route.slice(1).map((point, index) => {
    const before = route[index]!;
    return haversineDistance(before[0], before[1], point[0], point[1]);
  });
  const totalDistance = distances.reduce((total, distance) => total + distance, 0);
  const targetDistance = Math.min(1, Math.max(0, ratio)) * totalDistance;
  let distanceBefore = 0;
  for (let index = 1; index < route.length; index += 1) {
    const distance = distances[index - 1]!;
    if (distanceBefore + distance >= targetDistance || index === route.length - 1) {
      const before = route[index - 1]!;
      const after = route[index]!;
      const remainder = distance === 0 ? 0 : (targetDistance - distanceBefore) / distance;
      return [
        before[0] + (after[0] - before[0]) * remainder,
        before[1] + (after[1] - before[1]) * remainder,
        before[2] + (after[2] - before[2]) * remainder,
      ] as const;
    }
    distanceBefore += distance;
  }
  return route.at(-1)!;
};

const createDemoActivityData = (spec: (typeof DEMO_FIT_SPECS)[number]): DemoActivityData => {
  let distanceM = 0;
  for (let index = 1; index < spec.route.length; index += 1) {
    const previous = spec.route[index - 1]!;
    const point = spec.route[index]!;
    distanceM += haversineDistance(previous[0], previous[1], point[0], point[1]);
  }
  const recordCount = Math.max(121, Math.floor(spec.elapsedTimeS / 5) + 1);
  const data: Record<ActivityStreamInput['type'], number[]> = {
    time: [],
    latitude: [],
    longitude: [],
    altitude: [],
    distance: [],
    speed: [],
    heartrate: [],
    cadence: [],
    power: [],
    temperature: [],
  };
  for (let index = 0; index < recordCount; index += 1) {
    const ratio = index / (recordCount - 1);
    const progress = demoActivityProgress(ratio);
    const [latitude, longitude, altitude] = interpolateDemoRoute(spec.route, progress);
    const averageSpeed = distanceM / spec.elapsedTimeS;
    data.time.push(Math.round(spec.elapsedTimeS * ratio));
    data.latitude.push(latitude);
    data.longitude.push(longitude);
    data.altitude.push(altitude);
    data.distance.push(distanceM * progress);
    data.speed.push(averageSpeed * (1 + Math.sin(ratio * Math.PI * 4) * 0.04 + Math.sin(ratio * Math.PI * 11) * 0.015));
    data.heartrate.push(spec.averageHeartRate + Math.sin(ratio * Math.PI * 2) * 5 + Math.sin(ratio * Math.PI * 7) * 2);
    data.cadence.push(spec.averageCadence + Math.sin(ratio * Math.PI * 6) * 4);
    data.power.push(spec.averagePower > 0 ? spec.averagePower + Math.sin(ratio * Math.PI * 3) * 25 : 0);
    data.temperature.push(12 - altitude / 100);
  }
  const averageSpeed = distanceM / spec.elapsedTimeS;
  return {
    streams: Object.entries(data).map(([type, values]) => ({
      type: type as ActivityStreamInput['type'],
      data: values,
    })),
    laps: [
      {
        lap_index: 0,
        started_at: spec.startedAt,
        elapsed_time: spec.elapsedTimeS,
        moving_time: spec.elapsedTimeS - 30,
        distance: distanceM,
        avg_hr: spec.averageHeartRate,
        max_hr: spec.maximumHeartRate,
        avg_power: spec.averagePower,
        avg_speed_mps: averageSpeed,
      },
    ],
  };
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

class DemoProvisioner {
  private readonly database: KondisDatabase;
  private readonly activityRepository: ActivityRepository;
  private readonly imageMetadata: Readonly<Record<string, readonly DemoImageMetadata[]>>;
  private readonly activityImageRepository: ActivityImageRepository;
  private readonly uploadRepository: UploadRepository;
  private readonly socialRepository: SocialRepository;

  public constructor(dependencies: DemoProvisioningDependencies) {
    this.database = dependencies.database;
    this.activityRepository = dependencies.activities;
    this.imageMetadata = dependencies.imageMetadata;
    this.activityImageRepository = dependencies.images;
    this.uploadRepository = dependencies.uploads;
    this.socialRepository = dependencies.social;
  }

  private async seedActivity(
    executor: KondisExecutor,
    user: DemoUser,
    spec: (typeof DEMO_FIT_SPECS)[number],
    index: number,
  ): Promise<string> {
    const data = createDemoActivityData(spec);
    const upload = await this.uploadRepository.create(
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
    const activityId = await this.activityRepository.create(
      {
        activity: {
          id: demoFixtureId(3, index),
          upload_id: upload.id,
          user_id: user.id,
          sport: spec.activitySport,
          name: spec.title,
          description: spec.description,
          tags: spec.tags,
          started_at: spec.startedAt,
          timezone_offset_minutes: 120,
        },
        streams: data.streams,
        laps: data.laps,
      },
      executor,
    );
    await insertBackgroundJobs(executor, [
      { name: JobName.ActivityMetricCompute, data: { id: activityId } },
      { name: JobName.ActivityRouteMatchCompute, data: { id: activityId } },
    ]);
    return activityId;
  }

  private async createDemoUsers(executor: KondisExecutor): Promise<DemoUser[]> {
    const existingUsers = await executor
      .selectFrom('user')
      .select(['id', 'email', 'role', 'first_name', 'last_name'])
      .where(
        'email',
        'in',
        USERS.map(({ email }) => email),
      )
      .execute();
    const usersByEmail = new Map(existingUsers.map((user) => [user.email, user]));

    for (const config of USERS) {
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

    return USERS.map(({ email }) => usersByEmail.get(email)!);
  }

  private async seedDemoSession(executor: KondisExecutor, userId: string): Promise<void> {
    const existing = await executor
      .selectFrom('auth_session')
      .select('id')
      .where('id', '=', SESSION_ID)
      .executeTakeFirst();
    if (existing) {
      return;
    }
    await executor
      .insertInto('auth_session')
      .values({
        id: SESSION_ID,
        user_id: userId,
        token_hash: DEMO_SESSION_TOKEN_HASH,
        expires_at: new Date('2099-01-01T00:00:00.000Z'),
      })
      .execute();
  }

  private async seedDemoImages(executor: KondisExecutor, activities: readonly DemoActivity[]): Promise<void> {
    for (const activity of activities) {
      const imageMetadata = this.imageMetadata[activity.spec.slug];
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
          (await this.activityImageRepository.getByUploadChecksum(activity.uploadId, checksum, executor)) ??
          (await this.activityImageRepository.create(
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

        await this.activityImageRepository.upsertFile(
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
  }

  private seedActivityForUser(
    executor: KondisExecutor,
    owner: DemoUser,
    spec: (typeof DEMO_FIT_SPECS)[number],
    index: number,
  ): Promise<string> {
    return this.seedActivity(executor, owner, spec, index);
  }

  private async seedSocialData(
    executor: KondisExecutor,
    users: readonly DemoUser[],
    activities: readonly DemoActivity[],
  ): Promise<void> {
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
        const createdAt = new Date(activity.spec.startedAt.getTime() + (commentIndex + 1) * 60 * 60 * 1000);
        await this.socialRepository.createComment(
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
  }

  public async provision(): Promise<ReturnType<typeof asAuthenticatedUser>> {
    const provisioning = await this.database.transaction().execute(async (transaction) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext('kondis:demo-provisioning'))`.execute(transaction);
      await transaction.deleteFrom('notification').execute();
      const users = await this.createDemoUsers(transaction);
      await this.seedDemoSession(transaction, users[0].id);
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
          id: await this.seedActivityForUser(transaction, owner, spec, index),
          uploadId: demoFixtureId(2, index),
          owner,
          spec,
        });
      }
      await this.seedDemoImages(transaction, activities);
      await this.seedSocialData(transaction, users, activities);
      return {
        user: asAuthenticatedUser(users[0]),
        activityIds: activities.map(({ id }) => id),
      };
    });

    for (const activityId of provisioning.activityIds) {
      const activity = await this.activityRepository.getById(activityId);
      if (!activity) {
        continue;
      }
      const jobs: JobItem[] = [];
      if (activity.metrics_computed_at === null) {
        jobs.push({ name: JobName.ActivityMetricCompute, data: { id: activityId } });
      } else if (activity.best_efforts_computed_at === null) {
        jobs.push({ name: JobName.ActivityBestEffortCompute, data: { id: activityId } });
      }
      if (activity.route_matches_computed_at === null) {
        jobs.push({ name: JobName.ActivityRouteMatchCompute, data: { id: activityId } });
      }
      await insertBackgroundJobs(this.database, jobs);
    }

    return provisioning.user;
  }
}

export const provisionDemoData = async (dependencies: DemoProvisioningDependencies) =>
  new DemoProvisioner(dependencies).provision();
