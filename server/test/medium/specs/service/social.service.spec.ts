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
});
