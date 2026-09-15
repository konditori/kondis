import { randomUUID } from 'node:crypto';

import { TakeoutImportItemKind, TakeoutImportItemStatus } from 'src/enum';
import { TakeoutRepository } from 'src/repositories/takeout.repository';
import { createMediumFactory } from 'test/medium.factory';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe(TakeoutRepository.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;
  beforeAll(() => {
    db = createMediumTestDatabase();
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db.destroy();
  });
  const setup = async () => {
    const store = new TakeoutRepository(db);
    const user = await createMediumFactory(db).newUser();
    const id = randomUUID();
    await store.create(id, user.id);
    const items = ['a', 'b', 'c'].map((itemKey) => ({ itemKey, kind: TakeoutImportItemKind.Activity, metadata: {} }));
    await store.registerItems(id, user.id, items);
    return { store, user, id, items };
  };

  it('claims each concurrent upload once and counts terminal notifications once', async () => {
    const { store, user, id } = await setup();
    const claims = await Promise.all(
      Array.from({ length: 8 }, () => store.beginItem(id, user.id, 'a', TakeoutImportItemKind.Activity)),
    );
    expect(claims.filter(Boolean)).toHaveLength(1);
    await store.finalize(id, user.id);
    await Promise.all(Array.from({ length: 8 }, () => store.completeItem(id, 'a', TakeoutImportItemStatus.Completed)));
    await store.completeItem(id, 'b', TakeoutImportItemStatus.Duplicate);
    await store.failItem(id, user.id, 'c', 'Invalid activity');
    await expect(store.get(id, user.id)).resolves.toMatchObject({
      status: 'completed',
      total: 3,
      uploaded: 3,
      processed: 3,
      failed: 1,
      duplicates: 1,
    });
    const failedItem = await db
      .selectFrom('takeout_import_item')
      .select(['status', 'error'])
      .where('import_id', '=', id)
      .where('item_key', '=', 'c')
      .executeTakeFirstOrThrow();
    expect(failedItem).toEqual({ status: 'failed', error: 'Invalid activity' });
  });

  it('finalizes after jobs finish and preserves extraction errors', async () => {
    const { store, user, id } = await setup();
    for (const key of ['a', 'b', 'c']) {
      await store.completeItem(id, key, TakeoutImportItemStatus.Completed);
    }
    await expect(store.get(id, user.id)).resolves.toMatchObject({ status: 'uploading' });
    await store.finalize(id, user.id, 1);
    await expect(store.get(id, user.id)).resolves.toMatchObject({
      status: 'completed',
      processed: 3,
      error: '1 archive entries could not be extracted',
    });
    await expect(
      store.registerItems(id, user.id, [{ itemKey: 'late', kind: TakeoutImportItemKind.Activity, metadata: {} }]),
    ).resolves.toEqual([]);
    await expect(store.get(id, user.id)).resolves.toMatchObject({ total: 3 });
  });

  it('resumes only pending and interrupted claims, without resubmitting queued jobs', async () => {
    const { store, user, id, items } = await setup();
    await store.beginItem(id, user.id, 'a', TakeoutImportItemKind.Activity);
    await store.markQueued(id, 'a');
    await store.beginItem(id, user.id, 'b', TakeoutImportItemKind.Activity);
    const pending = await store.registerItems(id, user.id, items);
    expect(pending.toSorted()).toEqual(['b', 'c']);
    await expect(store.get(id, user.id)).resolves.toMatchObject({ total: 3, uploaded: 1, processed: 0 });
  });

  it('can retry a failed claim before finalization without double counting', async () => {
    const { store, user, id } = await setup();
    await store.failItem(id, user.id, 'a', 'Temporary failure');
    expect(await store.beginItem(id, user.id, 'a', TakeoutImportItemKind.Activity)).toBe(true);
    await store.completeItem(id, 'a', TakeoutImportItemStatus.Completed);
    await expect(store.get(id, user.id)).resolves.toMatchObject({ uploaded: 1, processed: 1, failed: 0 });
  });

  it('rejects other users and new work after cancellation, despite late completions', async () => {
    const { store, user, id, items } = await setup();
    const other = await createMediumFactory(db).newUser();
    await expect(store.get(id, other.id)).resolves.toBeUndefined();
    await expect(store.registerItems(id, other.id, items)).resolves.toEqual([]);
    await expect(store.beginItem(id, other.id, 'a', TakeoutImportItemKind.Activity)).resolves.toBe(false);
    await expect(store.cancel(id, other.id)).resolves.toBe(false);
    await store.beginItem(id, user.id, 'a', TakeoutImportItemKind.Activity);
    await store.cancel(id, user.id);
    await store.completeItem(id, 'a', TakeoutImportItemStatus.Completed);
    await expect(store.beginItem(id, user.id, 'b', TakeoutImportItemKind.Activity)).resolves.toBe(false);
    await store.finalize(id, user.id);
    await expect(store.get(id, user.id)).resolves.toMatchObject({ status: 'cancelled', uploaded: 1, processed: 1 });
  });

  it('checkpoints photo associations across scans, scoped to the owner and pending item', async () => {
    const { store, user, id, items } = await setup();
    const other = await createMediumFactory(db).newUser();
    const photo = {
      photoKey: 'media/photo.png',
      storagePath: 'temporary/photo.png',
      checksum: 'abc',
      originalName: 'photo.png',
      caption: 'Synthetic',
      sortOrder: 0,
    };
    await expect(store.stagePhoto(id, other.id, 'a', photo)).resolves.toBe(false);
    await expect(store.stagePhoto(id, user.id, 'missing', photo)).resolves.toBe(false);
    await expect(store.stagePhoto(id, user.id, 'a', photo)).resolves.toBe(true);
    await expect(store.stagePhoto(id, user.id, 'a', photo)).resolves.toBe(true);
    await store.registerItems(id, user.id, items);
    await expect(store.getStagedPhotos(id, user.id, 'a')).resolves.toEqual([photo]);
    await expect(store.getStagedPhotos(id, other.id, 'a')).resolves.toEqual([]);
    await store.beginItem(id, user.id, 'a', TakeoutImportItemKind.Activity);
    await expect(store.stagePhoto(id, user.id, 'a', photo)).resolves.toBe(false);
    await store.cancel(id, user.id);
    await expect(store.stagePhoto(id, user.id, 'b', photo)).resolves.toBe(false);
  });
});
