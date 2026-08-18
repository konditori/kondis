import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SocialService } from 'src/services/social.service';

import { createMediumFactory } from 'test/medium.factory';
import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(SocialService.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;
  let testApp: TestApp;
  let sut: SocialService;
  let factory: ReturnType<typeof createMediumFactory>;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();
    sut = testApp.get(SocialService);
    factory = createMediumFactory(db);
  });

  beforeEach(async () => {
    await resetMediumTestDatabase(db);
  });

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  it('creates, lists, updates, and deletes comments chronologically', async () => {
    const owner = await factory.newUser();
    const activityId = await factory.newActivity(owner.id, new Date('2024-01-01T08:00:00.000Z'), 'commented activity');

    const first = await sut.addComment(activityId, owner.id, 'First');
    const second = await sut.addComment(activityId, owner.id, 'Second');
    const listed = await sut.comments(activityId, owner.id);

    expect(listed.comments.map(({ body }) => body)).toEqual(['First', 'Second']);
    expect(listed.comments[0].user.id).toBe(owner.id);

    const updated = await sut.updateComment(activityId, second.id, owner.id, 'Updated');
    expect(updated.body).toBe('Updated');

    await sut.deleteComment(activityId, first.id, owner.id);
    await expect(sut.comments(activityId, owner.id)).resolves.toMatchObject({
      comments: [{ id: second.id, body: 'Updated' }],
    });
  });

  it('allows only the comment author to edit or delete a comment', async () => {
    const owner = await factory.newUser();
    const other = await factory.newUser();
    const activityId = await factory.newActivity(owner.id, new Date('2024-01-01T08:00:00.000Z'), 'owned activity');
    await db.insertInto('user_follow').values({ follower_id: other.id, followee_id: owner.id }).execute();
    const comment = await sut.addComment(activityId, owner.id, 'Owner comment');

    await expect(sut.updateComment(activityId, comment.id, other.id, 'Changed')).rejects.toMatchObject({ status: 404 });
    await expect(sut.deleteComment(activityId, comment.id, other.id)).rejects.toMatchObject({ status: 404 });
    await expect(sut.comments(activityId, owner.id)).resolves.toMatchObject({ comments: [{ body: 'Owner comment' }] });
  });

  it('tracks likes idempotently and removes them', async () => {
    const owner = await factory.newUser();
    const follower = await factory.newUser();
    const activityId = await factory.newActivity(owner.id, new Date('2024-01-01T08:00:00.000Z'), 'liked activity');

    await expect(sut.like(activityId, follower.id, true)).rejects.toMatchObject({ status: 404 });
    await db.insertInto('user_follow').values({ follower_id: follower.id, followee_id: owner.id }).execute();

    await expect(sut.like(activityId, follower.id, true)).resolves.toEqual({ liked: true, likeCount: 1 });
    await expect(sut.like(activityId, follower.id, true)).resolves.toEqual({ liked: true, likeCount: 1 });
    await expect(sut.like(activityId, follower.id, false)).resolves.toEqual({ liked: false, likeCount: 0 });
  });

  it('lists likers and notifies an activity owner only once per new like', async () => {
    const owner = await factory.newUser();
    const follower = await factory.newUser();
    const activityId = await factory.newActivity(owner.id, new Date('2024-01-01T08:00:00.000Z'), 'liked activity');
    await db.insertInto('user_follow').values({ follower_id: follower.id, followee_id: owner.id }).execute();

    await sut.like(activityId, follower.id, true);
    await sut.like(activityId, follower.id, true);

    await expect(sut.likers(activityId, owner.id)).resolves.toMatchObject([
      { id: follower.id, firstName: follower.firstName, lastName: follower.lastName },
    ]);
    await expect(sut.notifications(owner.id)).resolves.toMatchObject({
      notifications: [
        {
          type: 'activity_like',
          activityId,
          activityName: 'liked activity',
          actor: { id: follower.id },
        },
      ],
    });
  });

  it('notifies an activity owner when a follower comments', async () => {
    const owner = await factory.newUser();
    const follower = await factory.newUser();
    const activityId = await factory.newActivity(owner.id, new Date('2024-01-01T08:00:00.000Z'), 'commented activity');
    await db.insertInto('user_follow').values({ follower_id: follower.id, followee_id: owner.id }).execute();

    await sut.addComment(activityId, follower.id, 'Nice work');

    await expect(sut.notifications(owner.id)).resolves.toMatchObject({
      notifications: [
        {
          type: 'activity_comment',
          activityId,
          activityName: 'commented activity',
          actor: { id: follower.id },
        },
      ],
    });
  });

  it('tracks unread notifications and marks them read', async () => {
    const owner = await factory.newUser();
    const follower = await factory.newUser();
    const activityId = await factory.newActivity(owner.id, new Date('2024-01-01T08:00:00.000Z'), 'read state activity');
    await db.insertInto('user_follow').values({ follower_id: follower.id, followee_id: owner.id }).execute();

    await sut.like(activityId, follower.id, true);
    await expect(sut.notifications(owner.id)).resolves.toMatchObject({ unreadCount: 1 });

    await expect(sut.markNotificationsRead(owner.id)).resolves.toEqual({ markedRead: true });
    await expect(sut.notifications(owner.id)).resolves.toMatchObject({
      unreadCount: 0,
      notifications: [{ readAt: expect.any(String) }],
    });
  });

  it('notifies a user about a new follow request without duplicating retries', async () => {
    const requester = await factory.newUser();
    const target = await factory.newUser();

    await expect(sut.sendRequest(requester.id, target.id)).resolves.toMatchObject({ outgoingRequest: true });
    await expect(sut.sendRequest(requester.id, target.id)).resolves.toMatchObject({ outgoingRequest: true });

    await expect(sut.notifications(target.id)).resolves.toMatchObject({
      notifications: [
        {
          type: 'follow_request',
          activityId: null,
          actor: { id: requester.id },
        },
      ],
    });
  });
});
