import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'kysely';
import { KYSELY } from 'src/db/database';
import type { ActivityCommentEvent, RealtimePort } from 'src/ports/realtime.port';
import { EventRepository } from 'src/repositories/event.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import type { KondisDatabase } from 'src/types';

@Injectable()
export class SocialService {
  constructor(
    private readonly social: SocialRepository,
    @Inject(KYSELY) private readonly db: KondisDatabase,
    @Inject(EventRepository) private readonly eventRepository: RealtimePort,
  ) {}

  async people(viewerId: string, query?: string) {
    const users = await this.social.searchUsers(viewerId, query);
    return Promise.all(users.map(async (user) => ({ user, relation: await this.social.relation(viewerId, user.id) })));
  }

  async person(viewerId: string, id: string) {
    const user = await this.social.getUser(id);
    if (!user) {
      throw new NotFoundException('Person does not exist');
    }
    const relation = await this.social.relation(viewerId, id);
    if (relation.blockedViewer) {
      throw new NotFoundException('Person does not exist');
    }
    return { user, relation };
  }

  async sendRequest(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw new BadRequestException('You cannot follow yourself');
    }
    if (!(await this.social.getUser(targetId))) {
      throw new NotFoundException('Person does not exist');
    }
    const before = await this.social.relation(viewerId, targetId);
    const relation = await this.social.sendRequest(viewerId, targetId);
    if (relation.blockedByViewer || relation.blockedViewer) {
      throw new NotFoundException('Person does not exist');
    }
    if (!before.outgoingRequest && relation.outgoingRequest) {
      await this.notify(targetId, viewerId, 'follow_request', null);
    }
    return relation;
  }

  async acceptRequest(viewerId: string, requestId: string) {
    if (!(await this.social.acceptRequest(requestId, viewerId))) {
      throw new NotFoundException('Follow request does not exist');
    }
    return { accepted: true };
  }

  async ignoreRequest(viewerId: string, requestId: string) {
    const result = await this.social.ignoreRequest(requestId, viewerId);
    if (Number(result[0]?.numDeletedRows ?? 0) === 0) {
      throw new NotFoundException('Follow request does not exist');
    }
  }

  async cancelRequest(viewerId: string, targetId: string) {
    const result = await this.social.cancelRequest(viewerId, targetId);
    if (Number(result[0]?.numDeletedRows ?? 0) === 0) {
      throw new NotFoundException('Follow request does not exist');
    }
  }

  async unfollow(viewerId: string, targetId: string) {
    await this.social.unfollow(viewerId, targetId);
  }

  async requests(viewerId: string, direction: 'incoming' | 'outgoing') {
    const rows = await this.social.listRequests(viewerId, direction);
    return rows.map((row) => ({
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      user: {
        id: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        avatarUrl: this.avatarUrl(row.user_id, row.avatar_path),
      },
    }));
  }

  async block(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw new BadRequestException('You cannot block yourself');
    }
    if (!(await this.social.getUser(targetId))) {
      throw new NotFoundException('Person does not exist');
    }
    await this.social.block(viewerId, targetId);
    return { blocked: true };
  }

  async unblock(viewerId: string, targetId: string) {
    await this.social.unblock(viewerId, targetId);
  }

  async like(activityId: string, viewerId: string, liked: boolean) {
    const activity = await this.social.canViewActivity(activityId, viewerId);
    if (!activity) {
      throw new NotFoundException('Activity does not exist');
    }
    if (liked) {
      const inserted = await this.db
        .insertInto('activity_like')
        .values({ activity_id: activityId, user_id: viewerId })
        .onConflict((oc) => oc.doNothing())
        .executeTakeFirst();
      if (Number(inserted.numInsertedOrUpdatedRows ?? 0) > 0) {
        await this.notify(activity.user_id, viewerId, 'activity_like', activityId);
      }
    } else {
      await this.db
        .deleteFrom('activity_like')
        .where('activity_id', '=', activityId)
        .where('user_id', '=', viewerId)
        .execute();
    }
    const row = await this.db
      .selectFrom('activity_like')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('activity_id', '=', activityId)
      .executeTakeFirstOrThrow();
    await this.eventRepository.emit('ActivityLikeUpdated', {
      id: activityId,
      likeCount: Number(row.count),
    });
    return { liked, likeCount: Number(row.count) };
  }

  async comments(activityId: string, viewerId: string, cursor?: string, limit = 50) {
    if (!(await this.social.canViewActivity(activityId, viewerId))) {
      throw new NotFoundException('Activity does not exist');
    }
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
    const rows = await query
      .orderBy('activity_comment.created_at', 'asc')
      .orderBy('activity_comment.id', 'asc')
      .limit(limit + 1)
      .execute();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      comments: page.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        user: {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          avatarUrl: this.avatarUrl(row.user_id, row.avatar_path),
        },
      })),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async addComment(activityId: string, viewerId: string, body: string) {
    const activity = await this.social.canViewActivity(activityId, viewerId);
    if (!activity) {
      throw new NotFoundException('Activity does not exist');
    }
    const user = await this.social.getUser(viewerId);
    if (!user) {
      throw new NotFoundException('Person does not exist');
    }
    const row = await this.db
      .insertInto('activity_comment')
      .values({ activity_id: activityId, user_id: viewerId, body: body.trim() })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.notify(activity.user_id, viewerId, 'activity_comment', activityId);
    const comment: ActivityCommentEvent = {
      id: row.id,
      body: row.body,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      user,
    };
    await this.eventRepository.emit('ActivityCommentCreated', { id: activityId }, comment);
    return comment;
  }

  async updateComment(activityId: string, commentId: string, viewerId: string, body: string) {
    const comment = await this.db
      .selectFrom('activity_comment')
      .selectAll()
      .where('id', '=', commentId)
      .where('activity_id', '=', activityId)
      .where('user_id', '=', viewerId)
      .executeTakeFirst();
    if (!comment) {
      throw new NotFoundException('Comment does not exist');
    }
    const row = await this.db
      .updateTable('activity_comment')
      .set({ body: body.trim() })
      .where('id', '=', commentId)
      .returningAll()
      .executeTakeFirstOrThrow();
    const user = await this.social.getUser(viewerId);
    if (!user) {
      throw new NotFoundException('Person does not exist');
    }
    const updatedComment: ActivityCommentEvent = {
      id: row.id,
      body: row.body,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      user,
    };
    await this.eventRepository.emit('ActivityCommentUpdated', { id: activityId }, updatedComment);
    return updatedComment;
  }

  async deleteComment(activityId: string, commentId: string, viewerId: string) {
    const row = await this.db
      .deleteFrom('activity_comment')
      .where('id', '=', commentId)
      .where('activity_id', '=', activityId)
      .where('user_id', '=', viewerId)
      .returning('id')
      .executeTakeFirst();
    if (!row) {
      throw new NotFoundException('Comment does not exist');
    }
    await this.eventRepository.emit('ActivityCommentDeleted', { id: activityId }, row.id);
  }

  async likers(activityId: string, viewerId: string) {
    if (!(await this.social.canViewActivity(activityId, viewerId))) {
      throw new NotFoundException('Activity does not exist');
    }
    const rows = await this.db
      .selectFrom('activity_like')
      .innerJoin('user', 'user.id', 'activity_like.user_id')
      .select(['user.id', 'user.first_name', 'user.last_name', 'user.avatar_path'])
      .where('activity_like.activity_id', '=', activityId)
      .orderBy('activity_like.created_at', 'desc')
      .execute();
    return rows.map((user) => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: this.avatarUrl(user.id, user.avatar_path),
    }));
  }

  async notifications(viewerId: string, limit = 20) {
    const [rows, unread] = await Promise.all([
      this.db
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
        .limit(Math.min(Math.max(limit, 1), 50))
        .execute(),
      this.db
        .selectFrom('notification')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('notification.user_id', '=', viewerId)
        .where('notification.read_at', 'is', null)
        .executeTakeFirstOrThrow(),
    ]);
    return {
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        createdAt: new Date(row.created_at).toISOString(),
        activityId: row.activity_id,
        activityName: row.activity_name,
        readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
        actor: {
          id: row.actor_id,
          firstName: row.first_name,
          lastName: row.last_name,
          avatarUrl: this.avatarUrl(row.actor_id, row.avatar_path),
        },
      })),
      unreadCount: Number(unread.count),
    };
  }

  async markNotificationsRead(viewerId: string) {
    const readAt = new Date();
    await this.db
      .updateTable('notification')
      .set({ read_at: readAt })
      .where('user_id', '=', viewerId)
      .where('read_at', 'is', null)
      .execute();
    await this.eventRepository.emit('NotificationsRead', { userId: viewerId, readAt: readAt.toISOString() });
    return { markedRead: true };
  }

  private async notify(
    recipientId: string | null,
    actorId: string,
    type: 'activity_like' | 'activity_comment' | 'follow_request',
    activityId: string | null,
  ) {
    if (!recipientId || recipientId === actorId) {
      return;
    }
    const row = await this.db
      .transaction()
      .execute((trx) =>
        trx
          .insertInto('notification')
          .values({ user_id: recipientId, actor_id: actorId, type, activity_id: activityId })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
    await this.eventRepository.emit('NotificationCreated', {
      recipientId,
      id: row.id,
      type: row.type,
      createdAt: new Date(row.created_at).toISOString(),
      activityId: row.activity_id,
    });
  }

  private avatarUrl(userId: string, path: string | null): string | null {
    return path ? `/api/v1/users/${userId}/avatar` : null;
  }
}
