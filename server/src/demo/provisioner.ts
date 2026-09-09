import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DEMO_FIT_SPECS, DEMO_SESSION_TOKEN_HASH, DEMO_USERS, JOHN_EMAIL, SESSION_ID } from 'src/demo/data';
import type { DirectActivityCreateDto } from 'src/dtos/activity.dto';
import { JobName, QueueName, UserRole } from 'src/enum';
import type { ActivityImageService } from 'src/services/activity-image.service';
import type { ActivityService } from 'src/services/activity.service';
import type { AuthService } from 'src/services/auth.service';
import type { SocialService } from 'src/services/social.service';
import type { UserService } from 'src/services/user.service';
import type { ActivityStreamInput, KondisDatabase } from 'src/types';
import { haversineDistance } from 'src/utils/geo';

export { SESSION_ID as DEMO_SESSION_ID } from 'src/demo/data';

export type DemoProvisioningDependencies = {
  activities: ActivityService;
  images: ActivityImageService;
  auth: AuthService;
  social: SocialService;
  users: UserService;
  queue: {
    getAllJobCounts: () => Promise<Record<QueueName, { failed: number }>>;
    queue: (item: { name: JobName.ActivityMetricCompute; data: { id: string } }) => Promise<void>;
    waitForQueueCompletion: (...queues: QueueName[]) => Promise<void>;
  };
  mediaDirectory: string;
};

type DemoUser = {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  follows: readonly string[];
};
type DemoActivityData = Pick<DirectActivityCreateDto, 'streams' | 'laps' | 'metrics'>;

const progress = (ratio: number): number => {
  const variation = Math.sin(ratio * Math.PI * 5) * 0.012 + Math.sin(ratio * Math.PI * 13) * 0.004;
  return Math.min(1, Math.max(0, ratio + variation * ratio * (1 - ratio)));
};

const interpolate = (route: (typeof DEMO_FIT_SPECS)[number]['route'], ratio: number) => {
  const lengths = route
    .slice(1)
    .map((point, index) => haversineDistance(route[index]![0], route[index]![1], point[0], point[1]));
  const target = Math.min(1, Math.max(0, ratio)) * lengths.reduce((sum, length) => sum + length, 0);
  let beforeLength = 0;
  for (let index = 1; index < route.length; index += 1) {
    const length = lengths[index - 1]!;
    if (beforeLength + length >= target || index === route.length - 1) {
      const before = route[index - 1]!;
      const after = route[index]!;
      const remainder = length === 0 ? 0 : (target - beforeLength) / length;
      return [
        before[0] + (after[0] - before[0]) * remainder,
        before[1] + (after[1] - before[1]) * remainder,
        before[2] + (after[2] - before[2]) * remainder,
      ] as const;
    }
    beforeLength += length;
  }
  return route.at(-1)!;
};

const createDemoActivityData = (spec: (typeof DEMO_FIT_SPECS)[number]): DemoActivityData => {
  let distance = 0;
  for (let index = 1; index < spec.route.length; index += 1) {
    distance += haversineDistance(
      spec.route[index - 1]![0],
      spec.route[index - 1]![1],
      spec.route[index]![0],
      spec.route[index]![1],
    );
  }
  const recordCount = Math.max(121, Math.floor(spec.elapsedTimeS / 5) + 1);
  const streams: Record<ActivityStreamInput['type'], number[]> = {
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
  const averageSpeed = distance / spec.elapsedTimeS;
  for (let index = 0; index < recordCount; index += 1) {
    const ratio = index / (recordCount - 1);
    const [latitude, longitude, altitude] = interpolate(spec.route, progress(ratio));
    streams.time.push(Math.round(spec.elapsedTimeS * ratio));
    streams.latitude.push(latitude);
    streams.longitude.push(longitude);
    streams.altitude.push(altitude);
    streams.distance.push(distance * progress(ratio));
    streams.speed.push(
      averageSpeed * (1 + Math.sin(ratio * Math.PI * 4) * 0.04 + Math.sin(ratio * Math.PI * 11) * 0.015),
    );
    streams.heartrate.push(
      spec.averageHeartRate + Math.sin(ratio * Math.PI * 2) * 5 + Math.sin(ratio * Math.PI * 7) * 2,
    );
    streams.cadence.push(spec.averageCadence + Math.sin(ratio * Math.PI * 6) * 4);
    streams.power.push(spec.averagePower > 0 ? spec.averagePower + Math.sin(ratio * Math.PI * 3) * 25 : 0);
    streams.temperature.push(12 - altitude / 100);
  }
  return {
    streams: Object.entries(streams).map(([type, data]) => ({
      type: type as ActivityStreamInput['type'],
      data,
    })),
    laps: [
      {
        lapIndex: 0,
        startedAt: spec.startedAt.toISOString(),
        elapsedTime: spec.elapsedTimeS,
        movingTime: spec.elapsedTimeS - 30,
        distance,
        avgHr: spec.averageHeartRate,
        maxHr: spec.maximumHeartRate,
        avgPower: spec.averagePower,
        avgSpeedMps: averageSpeed,
      },
    ],
    metrics: {
      elapsedTime: spec.elapsedTimeS,
      movingTime: spec.elapsedTimeS - 30,
      distance,
      elevationGain: null,
      elevationLoss: null,
      avgSpeed: averageSpeed,
      maxSpeed: null,
      avgHr: spec.averageHeartRate,
      maxHr: spec.maximumHeartRate,
      avgCadence: spec.averageCadence,
      maxCadence: spec.maximumCadence,
      avgPower: spec.averagePower || null,
      maxPower: spec.maximumPower || null,
      normalizedPower: null,
      calories: spec.calories,
    },
  };
};

export const getDemoUser = async (database: KondisDatabase) => {
  const user = await database
    .selectFrom('user')
    .select(['id', 'email', 'role', 'first_name', 'last_name'])
    .where('email', '=', JOHN_EMAIL)
    .executeTakeFirst();
  if (!user) {
    throw new Error(`Demo database is not seeded; expected ${JOHN_EMAIL}`);
  }
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
  };
};

export class DemoProvisioner {
  constructor(private readonly dependencies: DemoProvisioningDependencies) {}

  async provision() {
    const users = await this.createUsers();
    await this.createFollows(users);
    await this.dependencies.auth.createSessionRecord({
      id: SESSION_ID,
      userId: users[0]!.id,
      tokenHash: DEMO_SESSION_TOKEN_HASH,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    const usersByEmail = new Map(users.map((user) => [user.email, user]));
    const configuredEmails = new Map<string, string>(DEMO_USERS.map((user) => [user.id, user.email]));
    for (const [index, spec] of DEMO_FIT_SPECS.entries()) {
      const owner = users[index % users.length]!;
      const activity = await this.dependencies.activities.createDirectActivity(owner.id, {
        sport: spec.activitySport,
        name: spec.title,
        description: spec.description,
        tags: [...spec.tags],
        startedAt: spec.startedAt.toISOString(),
        timezoneOffsetMinutes: 120,
        ...createDemoActivityData(spec),
      });
      // Make the demo use the same asynchronous metrics, best-effort, and route pipeline as a real activity.
      await this.dependencies.queue.queue({
        name: JobName.ActivityMetricCompute,
        data: { id: activity.id },
      });
      for (const comment of spec.comments) {
        const user = usersByEmail.get(configuredEmails.get(comment.userId)!);
        if (!user) {
          throw new Error(`Missing demo comment user ${comment.userId}`);
        }
        await this.follow(user, owner);
        await this.dependencies.social.addComment(activity.id, user.id, comment.body);
      }
      for (const likeId of spec.likes) {
        const user = usersByEmail.get(configuredEmails.get(likeId)!);
        if (!user) {
          throw new Error(`Missing demo like user ${likeId}`);
        }
        await this.follow(user, owner);
        await this.dependencies.social.like(activity.id, user.id, true);
      }
      for (const file of spec.imageFiles) {
        const buffer = await readFile(join(this.dependencies.mediaDirectory, 'activities', file));
        await this.dependencies.images.upload(
          activity.id,
          { originalname: file, buffer, size: buffer.length },
          undefined,
          owner.id,
        );
      }
    }
    await this.dependencies.queue.waitForQueueCompletion();
    const failed = Object.entries(await this.dependencies.queue.getAllJobCounts()).filter(
      ([, counts]) => counts.failed > 0,
    );
    if (failed.length > 0) {
      throw new Error(`Demo provisioning jobs failed: ${failed.map(([queue]) => queue).join(', ')}`);
    }
    return users[0]!;
  }

  private async createUsers(): Promise<DemoUser[]> {
    const result: DemoUser[] = [];
    for (const config of DEMO_USERS) {
      const created = await this.dependencies.auth.create(
        config.email,
        config.first_name,
        config.last_name,
        'demo-password',
        config.role,
      );
      if ('avatar_path' in config && config.avatar_path) {
        const buffer = await readFile(join(this.dependencies.mediaDirectory, config.avatar_path));
        await this.dependencies.users.uploadAvatar(created.id, {
          originalname: config.avatar_path,
          buffer,
          size: buffer.length,
        });
      }
      result.push({
        id: created.id,
        email: created.email,
        role: created.role,
        firstName: created.first_name,
        lastName: created.last_name,
        follows: config.follows,
      });
    }
    return result;
  }

  private async createFollows(users: readonly DemoUser[]) {
    const configuredEmails = new Map<string, string>(DEMO_USERS.map((user) => [user.id, user.email]));
    for (const follower of users) {
      for (const followeeId of follower.follows) {
        const followee = users.find((user) => user.email === configuredEmails.get(followeeId));
        if (!followee) {
          throw new Error(`Missing demo follow user ${followeeId}`);
        }
        await this.follow(follower, followee);
      }
    }
  }

  private async follow(follower: DemoUser, followee: DemoUser) {
    if (follower.id === followee.id) {
      return;
    }
    const relation = await this.dependencies.social.sendRequest(follower.id, followee.id);
    if (relation.following) {
      return;
    }
    const requests = await this.dependencies.social.requests(followee.id, 'incoming');
    const request = requests.find((item) => item.user.id === follower.id);
    if (!request) {
      throw new Error(`Missing follow request from ${follower.email}`);
    }
    await this.dependencies.social.acceptRequest(followee.id, request.id);
  }
}

export const provisionDemoData = (dependencies: DemoProvisioningDependencies) =>
  new DemoProvisioner(dependencies).provision();
