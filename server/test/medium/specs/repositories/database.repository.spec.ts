import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DatabaseRepository } from 'src/repositories/database.repository';
import { UserRepository } from 'src/repositories/user.repository';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(DatabaseRepository.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(() => {
    db = createMediumTestDatabase();
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  const setup = () => ({ sut: new DatabaseRepository(db), users: new UserRepository(db) });

  it('commits work performed in a transaction', async () => {
    const { sut, users } = setup();

    await sut.withTransaction(async (trx) => {
      await trx
        .insertInto('user')
        .values({
          email: 'transaction@example.com',
          name: 'Transaction User',
          password_hash: 'hash',
          role: 'user',
        })
        .execute();
    });

    await expect(users.findByEmail('transaction@example.com')).resolves.toBeDefined();
  });

  it('rolls back work when the transaction callback fails', async () => {
    const { sut, users } = setup();

    await expect(
      sut.withTransaction(async (trx) => {
        await trx
          .insertInto('user')
          .values({
            email: 'rollback@example.com',
            name: 'Rollback User',
            password_hash: 'hash',
            role: 'user',
          })
          .execute();
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    await expect(users.findByEmail('rollback@example.com')).resolves.toBeUndefined();
  });
});
