import type { ActivityCommentEvent } from 'src/contracts/realtime.repository';
import { BadRequestException, NotFoundException } from 'src/errors';
import { BaseService } from 'src/services/base.service';
import { publicMediaUrl } from 'src/utils/media';

export class SocialService extends BaseService {
  async people(viewerId: string, query?: string) {
    const users = await this.socialRepository.searchUsers(viewerId, query);
    return Promise.all(
      users.map(async (user) => ({ user, relation: await this.socialRepository.relation(viewerId, user.id) })),
    );
  }

  async person(viewerId: string, id: string) {
    const user = await this.socialRepository.getUser(id);
    if (!user) {
      throw new NotFoundException('Person does not exist');
    }
    const relation = await this.socialRepository.relation(viewerId, id);
    if (relation.blockedViewer) {
      throw new NotFoundException('Person does not exist');
    }
    return { user, relation };
  }

  async sendRequest(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw new BadRequestException('You cannot follow yourself');
    }
    if (!(await this.socialRepository.getUser(targetId))) {
      throw new NotFoundException('Person does not exist');
    }
    const before = await this.socialRepository.relation(viewerId, targetId);
    const relation = await this.socialRepository.sendRequest(viewerId, targetId);
    if (relation.blockedByViewer || relation.blockedViewer) {
      throw new NotFoundException('Person does not exist');
    }
    if (!before.outgoingRequest && relation.outgoingRequest) {
      await this.notify(targetId, viewerId, 'follow_request', null);
    }
    return relation;
  }

  async acceptRequest(viewerId: string, requestId: string) {
    if (!(await this.socialRepository.acceptRequest(requestId, viewerId))) {
      throw new NotFoundException('Follow request does not exist');
    }
    return { accepted: true };
  }

  async ignoreRequest(viewerId: string, requestId: string) {
    const result = await this.socialRepository.ignoreRequest(requestId, viewerId);
    if (Number(result[0]?.numDeletedRows ?? 0) === 0) {
      throw new NotFoundException('Follow request does not exist');
    }
  }

  async cancelRequest(viewerId: string, targetId: string) {
    const result = await this.socialRepository.cancelRequest(viewerId, targetId);
    if (Number(result[0]?.numDeletedRows ?? 0) === 0) {
      throw new NotFoundException('Follow request does not exist');
    }
  }

  async unfollow(viewerId: string, targetId: string) {
    await this.socialRepository.unfollow(viewerId, targetId);
  }

  async requests(viewerId: string, direction: 'incoming' | 'outgoing') {
    const rows = await this.socialRepository.listRequests(viewerId, direction);
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
    if (!(await this.socialRepository.getUser(targetId))) {
      throw new NotFoundException('Person does not exist');
    }
    await this.socialRepository.block(viewerId, targetId);
    return { blocked: true };
  }

  async unblock(viewerId: string, targetId: string) {
    await this.socialRepository.unblock(viewerId, targetId);
  }

  async like(activityId: string, viewerId: string, liked: boolean) {
    const activity = await this.socialRepository.canViewActivity(activityId, viewerId);
    if (!activity) {
      throw new NotFoundException('Activity does not exist');
    }
    if (liked) {
      const inserted = await this.socialRepository.addLike(activityId, viewerId);
      if (inserted > 0) {
        await this.notify(activity.user_id, viewerId, 'activity_like', activityId);
      }
    } else {
      await this.socialRepository.removeLike(activityId, viewerId);
    }
    const likeCount = await this.socialRepository.countLikes(activityId);
    await this.eventRepository.emit('ActivityLikeUpdated', {
      id: activityId,
      likeCount,
    });
    return { liked, likeCount };
  }

  async comments(activityId: string, userId: string, cursor?: string, limit = 50) {
    if (!(await this.socialRepository.canViewActivity(activityId, userId))) {
      throw new NotFoundException('Activity does not exist');
    }
    const rows = await this.socialRepository.listComments(activityId, userId, cursor, limit);
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

  async addComment(activityId: string, userId: string, body: string) {
    const activity = await this.socialRepository.canViewActivity(activityId, userId);
    if (!activity) {
      throw new NotFoundException('Activity does not exist');
    }
    const user = await this.socialRepository.getUser(userId);
    if (!user) {
      throw new NotFoundException('Person does not exist');
    }
    const row = await this.socialRepository.createComment({
      activity_id: activityId,
      user_id: userId,
      body: body.trim(),
    });
    await this.notify(activity.user_id, userId, 'activity_comment', activityId);
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

  async updateComment(activityId: string, commentId: string, userId: string, body: string) {
    const comment = await this.socialRepository.getComment(activityId, commentId, userId);
    if (!comment) {
      throw new NotFoundException('Comment does not exist');
    }
    const row = await this.socialRepository.updateComment(commentId, body.trim());
    const user = await this.socialRepository.getUser(userId);
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

  async deleteComment(activityId: string, commentId: string, userId: string) {
    const row = await this.socialRepository.deleteComment(activityId, commentId, userId);
    if (!row) {
      throw new NotFoundException('Comment does not exist');
    }
    await this.eventRepository.emit('ActivityCommentDeleted', { id: activityId }, row.id);
  }

  async likers(activityId: string, viewerId: string) {
    if (!(await this.socialRepository.canViewActivity(activityId, viewerId))) {
      throw new NotFoundException('Activity does not exist');
    }
    const rows = await this.socialRepository.listLikers(activityId);
    return rows.map((user) => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: this.avatarUrl(user.id, user.avatar_path),
    }));
  }

  async notifications(viewerId: string, limit = 20) {
    const [rows, unreadCount] = await Promise.all([
      this.socialRepository.listNotifications(viewerId, Math.min(Math.max(limit, 1), 50)),
      this.socialRepository.countUnreadNotifications(viewerId),
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
      unreadCount,
    };
  }

  async markNotificationsRead(viewerId: string) {
    const readAt = new Date();
    await this.socialRepository.markNotificationsRead(viewerId, readAt);
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
    const row = await this.socialRepository.createNotification({
      user_id: recipientId,
      actor_id: actorId,
      type,
      activity_id: activityId,
    });
    await this.eventRepository.emit('NotificationCreated', {
      recipientId,
      id: row.id,
      type: row.type,
      createdAt: new Date(row.created_at).toISOString(),
      activityId: row.activity_id,
    });
  }

  private avatarUrl(userId: string, path: string | null): string | null {
    return path ? publicMediaUrl(this.mediaBaseUrl, path, `/api/v1/users/${userId}/avatar`) : null;
  }
}
