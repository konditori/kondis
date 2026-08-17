import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'kysely';
import { KYSELY, KondisDatabase } from 'src/db/database';
import { SocialRepository, SocialUser } from 'src/repositories/social.repository';
import { ActivityService } from 'src/services/activity.service';

@Injectable()
export class SocialService {
  constructor(
    private readonly social: SocialRepository,
    private readonly activities: ActivityService,
    @Inject(KYSELY) private readonly db: KondisDatabase,
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
    const relation = await this.social.sendRequest(viewerId, targetId);
    if (relation.blockedByViewer || relation.blockedViewer) {
      throw new NotFoundException('Person does not exist');
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
      user: { id: row.user_id, name: row.name, avatarUrl: this.avatarUrl(row.user_id, row.avatar_path) },
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

  async feed(
    viewerId: string,
    query: { cursor?: string; limit?: number; search?: string; tags?: string; tagMatch?: 'any' | 'all' },
  ) {
    const page = await this.activities.listRecent(query, viewerId, viewerId);
    const ids = page.activities.map((activity) => activity.id);
    if (ids.length === 0) {
      return page;
    }
    const [engagement, users] = await Promise.all([
      this.engagement(ids, viewerId),
      Promise.all(
        [...new Set(page.activities.map((a) => a.userId).filter((id): id is string => !!id))].map((id) =>
          this.social.getUser(id),
        ),
      ),
    ]);
    const userMap = new Map(users.filter((user): user is SocialUser => !!user).map((user) => [user.id, user]));
    const engagementMap = new Map(engagement.map((row) => [row.activity_id, row]));
    return {
      ...page,
      activities: page.activities.map((activity) => ({
        ...activity,
        athlete: activity.userId ? userMap.get(activity.userId) : undefined,
        likeCount: Number(engagementMap.get(activity.id)?.like_count ?? 0),
        commentCount: Number(engagementMap.get(activity.id)?.comment_count ?? 0),
        viewerLiked: !!engagementMap.get(activity.id)?.viewer_liked,
      })),
    };
  }

  async profileActivities(
    viewerId: string,
    targetId: string,
    query: { cursor?: string; limit?: number; search?: string; tags?: string; tagMatch?: 'any' | 'all' },
  ) {
    if (!(await this.social.canViewUser(viewerId, targetId))) {
      throw new NotFoundException('Person does not exist');
    }
    const page = await this.activities.listRecent(query, targetId);
    const ids = page.activities.map((activity) => activity.id);
    if (ids.length === 0) {
      return page;
    }
    const [engagement, athlete] = await Promise.all([this.engagement(ids, viewerId), this.social.getUser(targetId)]);
    const engagementMap = new Map(engagement.map((row) => [row.activity_id, row]));
    return {
      ...page,
      activities: page.activities.map((activity) => ({
        ...activity,
        athlete: athlete ?? undefined,
        likeCount: Number(engagementMap.get(activity.id)?.like_count ?? 0),
        commentCount: Number(engagementMap.get(activity.id)?.comment_count ?? 0),
        viewerLiked: !!engagementMap.get(activity.id)?.viewer_liked,
      })),
    };
  }

  async like(activityId: string, viewerId: string, liked: boolean) {
    if (!(await this.social.canViewActivity(activityId, viewerId))) {
      throw new NotFoundException('Activity does not exist');
    }
    if (liked) {
      await this.db
        .insertInto('activity_like')
        .values({ activity_id: activityId, user_id: viewerId })
        .onConflict((oc) => oc.doNothing())
        .execute();
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
        'user.name',
      ])
      .where('activity_comment.activity_id', '=', activityId)
      .where(
        sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = activity_comment.user_id) OR (b.blocker_id = activity_comment.user_id AND b.blocked_id = ${viewerId}::uuid))`,
      );
    if (cursor) {
      query = query.where('activity_comment.id', '<', cursor);
    }
    const rows = await query
      .orderBy('activity_comment.created_at', 'desc')
      .orderBy('activity_comment.id', 'desc')
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
        user: { id: row.user_id, name: row.name, avatarUrl: this.avatarUrl(row.user_id, row.avatar_path) },
      })),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async addComment(activityId: string, viewerId: string, body: string) {
    if (!(await this.social.canViewActivity(activityId, viewerId))) {
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
    return {
      id: row.id,
      body: row.body,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      user,
    };
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
    return {
      id: row.id,
      body: row.body,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      user,
    };
  }

  async deleteComment(activityId: string, commentId: string, viewerId: string) {
    const row = await this.db
      .selectFrom('activity_comment')
      .innerJoin('activity', 'activity.id', 'activity_comment.activity_id')
      .select(['activity_comment.user_id', 'activity.user_id as owner_id'])
      .where('activity_comment.id', '=', commentId)
      .where('activity_comment.activity_id', '=', activityId)
      .executeTakeFirst();
    if (!row || (row.user_id !== viewerId && row.owner_id !== viewerId)) {
      throw new NotFoundException('Comment does not exist');
    }
    await this.db.deleteFrom('activity_comment').where('id', '=', commentId).execute();
  }

  private engagement(ids: string[], viewerId: string) {
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

  private avatarUrl(userId: string, path: string | null): string | null {
    return path ? `/api/v1/users/${userId}/avatar` : null;
  }
}
