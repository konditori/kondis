import { sql } from 'kysely';

import { insertBackgroundJobs } from 'src/cloudflare/background-job';
import {
  DEMO_ACTIVITY_IMAGE_IDS,
  DEMO_FIT_SPECS,
  DEMO_IMAGE_MIME_TYPE,
  DEMO_PASSWORD_HASH,
  DEMO_SESSION_TOKEN_HASH,
  DEMO_UPLOAD_IDS,
  DEMO_USERS,
  JOHN_USER_ID,
  SESSION_ID,
} from 'src/demo/data';
import { JobName, type UserRole } from 'src/enum';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { MediaRepository } from 'src/repositories/media.repository';
import { SessionRepository } from 'src/repositories/session.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
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
  images: MediaRepository;
  uploads: UploadRepository;
  social: SocialRepository;
  sessions: SessionRepository;
  users: UserRepository;
};

type DemoUser = {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  follows: readonly string[];
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

const asAuthenticatedUser = (user: Omit<DemoUser, 'follows'>) => ({
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
    .where('id', '=', JOHN_USER_ID)
    .executeTakeFirst();
  if (!user) {
    throw new Error(`Demo database is not seeded; expected ${JOHN_USER_ID}`);
  }
  return asAuthenticatedUser(user);
};

class DemoProvisioner {
  private readonly database: KondisDatabase;
  private readonly activityRepository: ActivityRepository;
  private readonly imageMetadata: Readonly<Record<string, readonly DemoImageMetadata[]>>;
  private readonly activityImageRepository: MediaRepository;
  private readonly uploadRepository: UploadRepository;
  private readonly socialRepository: SocialRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly userRepository: UserRepository;

  public constructor(dependencies: DemoProvisioningDependencies) {
    this.database = dependencies.database;
    this.activityRepository = dependencies.activities;
    this.imageMetadata = dependencies.imageMetadata;
    this.activityImageRepository = dependencies.images;
    this.uploadRepository = dependencies.uploads;
    this.socialRepository = dependencies.social;
    this.sessionRepository = dependencies.sessions;
    this.userRepository = dependencies.users;
  }

  private async provisionActivity(
    executor: KondisExecutor,
    user: DemoUser,
    spec: (typeof DEMO_FIT_SPECS)[number],
    usersById: ReadonlyMap<string, DemoUser>,
  ): Promise<string> {
    const data = createDemoActivityData(spec);
    const upload = await this.uploadRepository.create(
      {
        id: DEMO_UPLOAD_IDS[spec.slug],
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
          id: spec.id,
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
    for (const [commentIndex, comment] of spec.comments.entries()) {
      const actor = usersById.get(comment.userId);
      if (!actor) {
        throw new Error(`Missing demo comment user ${comment.userId}`);
      }
      const createdAt = new Date(spec.startedAt.getTime() + (commentIndex + 1) * 60 * 60 * 1000);
      await this.socialRepository.createComment(
        {
          activity_id: activityId,
          user_id: actor.id,
          body: comment.body,
          created_at: createdAt,
          updated_at: createdAt,
        },
        executor,
      );
    }
    for (const likeUserId of spec.likes) {
      const actor = usersById.get(likeUserId);
      if (!actor) {
        throw new Error(`Missing demo like user ${likeUserId}`);
      }
      await executor.insertInto('activity_like').values({ activity_id: activityId, user_id: actor.id }).execute();
    }
    const imageMetadata = this.imageMetadata[spec.slug];
    if (!imageMetadata) {
      throw new Error(`Missing demo image metadata for ${spec.slug}`);
    }
    for (const [imageIndex, metadata] of imageMetadata.entries()) {
      const checksum = imageIndex === 0 ? `demo-image-v1:${spec.slug}` : `demo-image-v1:${spec.slug}:${imageIndex + 1}`;
      const image = await this.activityImageRepository.create(
        {
          id: DEMO_ACTIVITY_IMAGE_IDS[spec.slug][imageIndex],
          upload_id: upload.id,
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
      );

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
    return activityId;
  }

  private async provisionUser(executor: KondisExecutor, config: (typeof DEMO_USERS)[number]): Promise<DemoUser> {
    const { follows, ...userConfig } = config;
    const user = await this.userRepository.create(
      {
        ...userConfig,
        password_hash: DEMO_PASSWORD_HASH,
      },
      executor,
    );
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      follows,
    };
  }

  private async provisionSession(executor: KondisExecutor, userId: string): Promise<void> {
    await this.sessionRepository.createSessionRecord(
      {
        id: SESSION_ID, // Use a fixed session ID and token hash for demo purposes

        userId,
        tokenHash: DEMO_SESSION_TOKEN_HASH,
      },
      executor,
    );
  }

  public async provision(): Promise<ReturnType<typeof asAuthenticatedUser>> {
    const provisioning = await this.database.transaction().execute(async (transaction) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext('kondis:demo-provisioning'))`.execute(transaction);
      await transaction.deleteFrom('notification').execute();

      const users: DemoUser[] = [];
      for (const user of DEMO_USERS) {
        users.push(await this.provisionUser(transaction, user));
      }
      const usersById = new Map(users.map((user) => [user.id, user]));

      for (const follower of users) {
        for (const followeeId of follower.follows) {
          const followee = usersById.get(followeeId);
          if (!followee) {
            throw new Error(`Missing demo follow user ${followeeId}`);
          }
          await transaction
            .insertInto('user_follow')
            .values({ follower_id: follower.id, followee_id: followee.id })
            .onConflict((conflict) => conflict.doNothing())
            .execute();
        }
      }

      await this.provisionSession(transaction, users[0].id);

      const activityIds: string[] = [];
      for (const [index, spec] of DEMO_FIT_SPECS.entries()) {
        const owner = users[index % users.length];
        activityIds.push(await this.provisionActivity(transaction, owner, spec, usersById));
      }
      return {
        user: asAuthenticatedUser(users[0]),
        activityIds,
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
