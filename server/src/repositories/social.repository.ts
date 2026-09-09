import { sql } from 'kysely';
import type { ActivityComment, NewActivityComment, Notification } from 'src/db/schema';
import type { ActivityEngagement, SocialUser } from 'src/dtos/social.dto';
import type { KondisDatabase, KondisExecutor } from 'src/types';
import { publicMediaUrl } from 'src/utils/media';

export class SocialRepository {
  constructor(
    private readonly db: KondisDatabase,
    private readonly mediaBaseUrl?: string,
  ) {}

  createComment(input: NewActivityComment, executor: KondisExecutor = this.db): Promise<ActivityComment> {
    return executor.insertInto('activity_comment').values(input).returningAll().executeTakeFirstOrThrow();
  }

  addLike(activityId: string, userId: string): Promise<number> {
    return this.db
      .insertInto('activity_like')
      .values({ activity_id: activityId, user_id: userId })
      .onConflict((oc) => oc.doNothing())
      .executeTakeFirst()
      .then((result) => Number(result.numInsertedOrUpdatedRows ?? 0));
  }

  removeLike(activityId: string, userId: string) {
    return this.db
      .deleteFrom('activity_like')
      .where('activity_id', '=', activityId)
      .where('user_id', '=', userId)
      .execute();
  }

  countLikes(activityId: string): Promise<number> {
    return this.db
      .selectFrom('activity_like')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('activity_id', '=', activityId)
      .executeTakeFirstOrThrow()
      .then((row) => Number(row.count));
  }

  async listComments(activityId: string, viewerId: string, cursor?: string, limit = 50) {
    let query = this.db
      .selectFrom('activity_comment')
      .innerJoin('user', 'user.id', 'activity_comment.user_id')
      .select([
        'activity_comment.id',
        'activity_comment.body',
        'activity_comment.created_at',
        'activity_comment.updated_at',
        'user.id as user_id',
        'user.avatar_path',
        'user.first_name',
        'user.last_name',
      ])
      .where('activity_comment.activity_id', '=', activityId)
      .where(
        sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = activity_comment.user_id) OR (b.blocker_id = activity_comment.user_id AND b.blocked_id = ${viewerId}::uuid))`,
      );
    if (cursor) {
      const cursorComment = await this.db
        .selectFrom('activity_comment')
        .select('created_at')
        .where('id', '=', cursor)
        .where('activity_id', '=', activityId)
        .executeTakeFirst();
      if (cursorComment) {
        query = query.where(({ and, eb, or }) =>
          or([
            eb('activity_comment.created_at', '>', cursorComment.created_at),
            and([
              eb('activity_comment.created_at', '=', cursorComment.created_at),
              eb('activity_comment.id', '>', cursor),
            ]),
          ]),
        );
      }
    }
    return query
      .orderBy('activity_comment.created_at', 'asc')
      .orderBy('activity_comment.id', 'asc')
      .limit(limit + 1)
      .execute();
  }

  getComment(activityId: string, commentId: string, userId: string) {
    return this.db
      .selectFrom('activity_comment')
      .selectAll()
      .where('id', '=', commentId)
      .where('activity_id', '=', activityId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }

  updateComment(commentId: string, body: string) {
    return this.db
      .updateTable('activity_comment')
      .set({ body })
      .where('id', '=', commentId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  deleteComment(activityId: string, commentId: string, userId: string) {
    return this.db
      .deleteFrom('activity_comment')
      .where('id', '=', commentId)
      .where('activity_id', '=', activityId)
      .where('user_id', '=', userId)
      .returning('id')
      .executeTakeFirst();
  }

  listLikers(activityId: string) {
    return this.db
      .selectFrom('activity_like')
      .innerJoin('user', 'user.id', 'activity_like.user_id')
      .select(['user.id', 'user.first_name', 'user.last_name', 'user.avatar_path'])
      .where('activity_like.activity_id', '=', activityId)
      .orderBy('activity_like.created_at', 'desc')
      .execute();
  }

  listNotifications(viewerId: string, limit: number) {
    return this.db
      .selectFrom('notification')
      .innerJoin('user as actor', 'actor.id', 'notification.actor_id')
      .leftJoin('activity', 'activity.id', 'notification.activity_id')
      .select([
        'notification.id',
        'notification.type',
        'notification.created_at',
        'notification.read_at',
        'notification.activity_id',
        'activity.name as activity_name',
        'actor.id as actor_id',
        'actor.first_name',
        'actor.last_name',
        'actor.avatar_path',
      ])
      .where('notification.user_id', '=', viewerId)
      .orderBy('notification.created_at', 'desc')
      .limit(limit)
      .execute();
  }

  countUnreadNotifications(viewerId: string): Promise<number> {
    return this.db
      .selectFrom('notification')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('notification.user_id', '=', viewerId)
      .where('notification.read_at', 'is', null)
      .executeTakeFirstOrThrow()
      .then((row) => Number(row.count));
  }

  markNotificationsRead(viewerId: string, readAt: Date) {
    return this.db
      .updateTable('notification')
      .set({ read_at: readAt })
      .where('user_id', '=', viewerId)
      .where('read_at', 'is', null)
      .execute();
  }

  createNotification(input: {
    user_id: string;
    actor_id: string;
    type: Notification['type'];
    activity_id: string | null;
  }): Promise<Notification> {
    return this.db
      .transaction()
      .execute((trx) => trx.insertInto('notification').values(input).returningAll().executeTakeFirstOrThrow());
  }

  activityEngagement(ids: string[], viewerId: string): Promise<ActivityEngagement[]> {
    return this.db
      .selectFrom('activity')
      .leftJoin('activity_like', 'activity_like.activity_id', 'activity.id')
      .leftJoin('activity_comment', 'activity_comment.activity_id', 'activity.id')
      .select([
        'activity.id as activity_id',
        sql<number>`count(distinct activity_like.user_id)`.as('like_count'),
        sql<number>`count(distinct activity_comment.id)`.as('comment_count'),
        sql<boolean>`bool_or(activity_like.user_id = ${viewerId})`.as('viewer_liked'),
      ])
      .where('activity.id', 'in', ids)
      .groupBy('activity.id')
      .execute();
  }

  getUser(id: string): Promise<SocialUser | undefined> {
    return this.db
      .selectFrom('user')
      .select(['user.id', 'user.first_name', 'user.last_name', 'user.avatar_path'])
      .where('user.id', '=', id)
      .executeTakeFirst()
      .then((user) => (user ? this.toSocialUser(user) : undefined));
  }

  searchUsers(viewerId: string, query?: string, limit = 50): Promise<SocialUser[]> {
    let request = this.db
      .selectFrom('user')
      .select(['user.id', 'user.first_name', 'user.last_name', 'user.avatar_path'])
      .where('user.id', '!=', viewerId)
      .where(
        sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = "user".id) OR (b.blocker_id = "user".id AND b.blocked_id = ${viewerId}::uuid))`,
      );
    if (query?.trim()) {
      const pattern = `%${query.trim()}%`;
      request = request.where(sql<string>`concat_ws(' ', user.first_name, user.last_name)`, 'ilike', pattern);
    }
    return request
      .orderBy('user.first_name')
      .orderBy('user.last_name')
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
          'user.first_name',
          'user.last_name',
          'user.avatar_path',
        ])
        .where('follow_request.target_id', '=', viewerId)
        .orderBy('follow_request.created_at', 'desc')
        .execute();
    }
    return this.db
      .selectFrom('follow_request')
      .innerJoin('user', 'user.id', 'follow_request.target_id')
      .select([
        'follow_request.id',
        'follow_request.created_at',
        'user.id as user_id',
        'user.first_name',
        'user.last_name',
        'user.avatar_path',
      ])
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

  private toSocialUser(user: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_path: string | null;
  }): SocialUser {
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_path
        ? publicMediaUrl(this.mediaBaseUrl, user.avatar_path, `/api/v1/users/${user.id}/avatar`)
        : null,
    };
  }
}
