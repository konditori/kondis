import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KYSELY, KondisDatabase, KondisExecutor } from 'src/db/database';

export type SocialUser = { id: string; name: string; avatarUrl: string | null };

@Injectable()
export class SocialRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  getUser(id: string): Promise<SocialUser | undefined> {
    return this.db
      .selectFrom('user')
      .select(['user.id', 'user.name', 'user.avatar_path'])
      .where('user.id', '=', id)
      .executeTakeFirst()
      .then((user) => (user ? this.toSocialUser(user) : undefined));
  }

  searchUsers(viewerId: string, query?: string, limit = 50): Promise<SocialUser[]> {
    let request = this.db
      .selectFrom('user')
      .select(['user.id', 'user.name', 'user.avatar_path'])
      .where('user.id', '!=', viewerId)
      .where(
        sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = "user".id) OR (b.blocker_id = "user".id AND b.blocked_id = ${viewerId}::uuid))`,
      );
    if (query?.trim()) {
      const pattern = `%${query.trim()}%`;
      request = request.where('user.name', 'ilike', pattern);
    }
    return request
      .orderBy('user.name')
      .orderBy('user.id')
      .limit(limit)
      .execute()
      .then((users) => users.map((user) => this.toSocialUser(user)));
  }

  async relation(viewerId: string, targetId: string) {
    const [following, incoming, outgoing, blockedByViewer, blockedViewer] = await Promise.all([
      this.db
        .selectFrom('user_follow')
        .select('follower_id')
        .where('follower_id', '=', viewerId)
        .where('followee_id', '=', targetId)
        .executeTakeFirst(),
      this.db
        .selectFrom('follow_request')
        .select('id')
        .where('requester_id', '=', targetId)
        .where('target_id', '=', viewerId)
        .executeTakeFirst(),
      this.db
        .selectFrom('follow_request')
        .select('id')
        .where('requester_id', '=', viewerId)
        .where('target_id', '=', targetId)
        .executeTakeFirst(),
      this.db
        .selectFrom('user_block')
        .select('blocker_id')
        .where('blocker_id', '=', viewerId)
        .where('blocked_id', '=', targetId)
        .executeTakeFirst(),
      this.db
        .selectFrom('user_block')
        .select('blocker_id')
        .where('blocker_id', '=', targetId)
        .where('blocked_id', '=', viewerId)
        .executeTakeFirst(),
    ]);
    return {
      following: !!following,
      incomingRequest: !!incoming,
      outgoingRequest: !!outgoing,
      blockedByViewer: !!blockedByViewer,
      blockedViewer: !!blockedViewer,
    };
  }

  async canViewUser(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) {
      return true;
    }
    const row = await this.db
      .selectFrom('user')
      .select('user.id')
      .where('user.id', '=', targetId)
      .where(
        sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = "user".id) OR (b.blocker_id = "user".id AND b.blocked_id = ${viewerId}::uuid))`,
      )
      .where(({ exists, selectFrom }) =>
        exists(
          selectFrom('user_follow')
            .select('follower_id')
            .where('follower_id', '=', viewerId)
            .whereRef('followee_id', '=', 'user.id'),
        ),
      )
      .executeTakeFirst();
    return !!row;
  }

  async canSeeProfile(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) {
      return true;
    }
    const row = await this.db
      .selectFrom('user')
      .select('user.id')
      .where('user.id', '=', targetId)
      .where(
        sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = "user".id) OR (b.blocker_id = "user".id AND b.blocked_id = ${viewerId}::uuid))`,
      )
      .executeTakeFirst();
    return !!row;
  }

  canViewActivity(activityId: string, viewerId: string): Promise<{ id: string; user_id: string | null } | undefined> {
    return this.db
      .selectFrom('activity')
      .select(['activity.id', 'activity.user_id'])
      .where('activity.id', '=', activityId)
      .where(({ or, eb, exists, selectFrom }) =>
        or([
          eb('activity.user_id', '=', viewerId),
          exists(
            selectFrom('user_follow')
              .select('follower_id')
              .where('follower_id', '=', viewerId)
              .whereRef('followee_id', '=', 'activity.user_id'),
          ),
        ]),
      )
      .where(
        sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = activity.user_id) OR (b.blocker_id = activity.user_id AND b.blocked_id = ${viewerId}::uuid))`,
      )
      .executeTakeFirst();
  }

  async sendRequest(requesterId: string, targetId: string) {
    return this.db.transaction().execute(async (trx) => {
      const relation = await this.relationIn(trx, requesterId, targetId);
      if (relation.blockedByViewer || relation.blockedViewer || relation.following) {
        return relation;
      }
      if (!relation.outgoingRequest) {
        await trx.insertInto('follow_request').values({ requester_id: requesterId, target_id: targetId }).execute();
      }
      return this.relationIn(trx, requesterId, targetId);
    });
  }

  async acceptRequest(requestId: string, targetId: string): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const request = await trx
        .selectFrom('follow_request')
        .selectAll()
        .where('id', '=', requestId)
        .where('target_id', '=', targetId)
        .executeTakeFirst();
      if (!request) {
        return false;
      }
      const blocked = await trx
        .selectFrom('user_block')
        .select('blocker_id')
        .where(({ or, and, eb }) =>
          or([
            and([eb('blocker_id', '=', targetId), eb('blocked_id', '=', request.requester_id)]),
            and([eb('blocker_id', '=', request.requester_id), eb('blocked_id', '=', targetId)]),
          ]),
        )
        .executeTakeFirst();
      if (blocked) {
        return false;
      }
      await trx
        .insertInto('user_follow')
        .values({ follower_id: request.requester_id, followee_id: targetId })
        .onConflict((oc) => oc.doNothing())
        .execute();
      await trx.deleteFrom('follow_request').where('id', '=', requestId).execute();
      return true;
    });
  }

  ignoreRequest(requestId: string, viewerId: string) {
    return this.db
      .deleteFrom('follow_request')
      .where('id', '=', requestId)
      .where(({ or, eb }) => or([eb('target_id', '=', viewerId), eb('requester_id', '=', viewerId)]))
      .execute();
  }

  cancelRequest(requesterId: string, targetId: string) {
    return this.db
      .deleteFrom('follow_request')
      .where('requester_id', '=', requesterId)
      .where('target_id', '=', targetId)
      .execute();
  }

  unfollow(followerId: string, followeeId: string) {
    return this.db
      .deleteFrom('user_follow')
      .where('follower_id', '=', followerId)
      .where('followee_id', '=', followeeId)
      .execute();
  }

  async block(blockerId: string, blockedId: string) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('user_block')
        .values({ blocker_id: blockerId, blocked_id: blockedId })
        .onConflict((oc) => oc.doNothing())
        .execute();
      await trx
        .deleteFrom('user_follow')
        .where(({ or, and, eb }) =>
          or([
            and([eb('follower_id', '=', blockerId), eb('followee_id', '=', blockedId)]),
            and([eb('follower_id', '=', blockedId), eb('followee_id', '=', blockerId)]),
          ]),
        )
        .execute();
      await trx
        .deleteFrom('follow_request')
        .where(({ or, and, eb }) =>
          or([
            and([eb('requester_id', '=', blockerId), eb('target_id', '=', blockedId)]),
            and([eb('requester_id', '=', blockedId), eb('target_id', '=', blockerId)]),
          ]),
        )
        .execute();
    });
  }

  unblock(blockerId: string, blockedId: string) {
    return this.db
      .deleteFrom('user_block')
      .where('blocker_id', '=', blockerId)
      .where('blocked_id', '=', blockedId)
      .execute();
  }

  listRequests(viewerId: string, direction: 'incoming' | 'outgoing') {
    if (direction === 'incoming') {
      return this.db
        .selectFrom('follow_request')
        .innerJoin('user', 'user.id', 'follow_request.requester_id')
        .select([
          'follow_request.id',
          'follow_request.created_at',
          'user.id as user_id',
          'user.name',
          'user.avatar_path',
        ])
        .where('follow_request.target_id', '=', viewerId)
        .orderBy('follow_request.created_at', 'desc')
        .execute();
    }
    return this.db
      .selectFrom('follow_request')
      .innerJoin('user', 'user.id', 'follow_request.target_id')
      .select(['follow_request.id', 'follow_request.created_at', 'user.id as user_id', 'user.name', 'user.avatar_path'])
      .where('follow_request.requester_id', '=', viewerId)
      .orderBy('follow_request.created_at', 'desc')
      .execute();
  }

  private relationIn(executor: KondisExecutor, viewerId: string, targetId: string) {
    return Promise.all([
      executor
        .selectFrom('user_follow')
        .select('follower_id')
        .where('follower_id', '=', viewerId)
        .where('followee_id', '=', targetId)
        .executeTakeFirst(),
      executor
        .selectFrom('follow_request')
        .select('id')
        .where('requester_id', '=', viewerId)
        .where('target_id', '=', targetId)
        .executeTakeFirst(),
      executor
        .selectFrom('user_block')
        .select('blocker_id')
        .where('blocker_id', '=', viewerId)
        .where('blocked_id', '=', targetId)
        .executeTakeFirst(),
      executor
        .selectFrom('user_block')
        .select('blocker_id')
        .where('blocker_id', '=', targetId)
        .where('blocked_id', '=', viewerId)
        .executeTakeFirst(),
    ]).then(([following, outgoing, blockedByViewer, blockedViewer]) => ({
      following: !!following,
      incomingRequest: false,
      outgoingRequest: !!outgoing,
      blockedByViewer: !!blockedByViewer,
      blockedViewer: !!blockedViewer,
    }));
  }

  private toSocialUser(user: { id: string; name: string; avatar_path: string | null }): SocialUser {
    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatar_path ? `/api/v1/users/${user.id}/avatar` : null,
    };
  }
}
