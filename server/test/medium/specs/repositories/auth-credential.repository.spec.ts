import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthCredentialRepository } from 'src/repositories/auth-credential.repository';
import { UserRepository } from 'src/repositories/user.repository';
import type { KondisDatabase } from 'src/types';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(AuthCredentialRepository.name, () => {
  let db: KondisDatabase;
  let credentials: AuthCredentialRepository;
  let users: UserRepository;

  beforeAll(() => {
    db = createMediumTestDatabase();
    credentials = new AuthCredentialRepository(db);
    users = new UserRepository(db);
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  const createUser = () =>
    users.create({
      email: `credential-${crypto.randomUUID()}@example.com`,
      first_name: 'Credential',
      last_name: 'Test',
      password_hash: 'not-used',
      role: 'user',
    });

  it('stores only a session hash and resolves the current user', async () => {
    const user = await createUser();
    const token = await credentials.createSession(user.id);

    const stored = await db.selectFrom('auth_session').selectAll().executeTakeFirstOrThrow();
    expect(token).toMatch(/^[a-f\d]{64}$/);
    expect(stored.token_hash).not.toBe(token);
    await expect(credentials.findSession(token)).resolves.toMatchObject({
      id: stored.id,
      user: { id: user.id, email: user.email, role: 'user' },
    });
    await expect(credentials.findSession(`${token}x`)).resolves.toBeUndefined();
  });

  it('revokes sessions immediately', async () => {
    const user = await createUser();
    const token = await credentials.createSession(user.id);
    const session = await credentials.findSession(token);
    const ticket = await credentials.createTicket('activity-events', user.id, session!.id);

    await credentials.revokeSession(session!.id);

    await expect(credentials.findSession(token)).resolves.toBeUndefined();
    await expect(credentials.findEventTicket(ticket.token)).resolves.toBeUndefined();
  });

  it('isolates ticket scopes and consumes setup tickets once', async () => {
    const user = await createUser();
    const sessionToken = await credentials.createSession(user.id);
    const session = await credentials.findSession(sessionToken);
    const eventTicket = await credentials.createTicket('activity-events', user.id, session!.id);
    await credentials.getOrCreateSetupToken();
    const setupTicket = await credentials.createTicket('initial-setup');

    await expect(credentials.findTicket(eventTicket.token, 'activity-events')).resolves.toEqual({ userId: user.id });
    await expect(credentials.findEventTicket(eventTicket.token)).resolves.toEqual({
      scope: 'activity-events',
      sessionId: session!.id,
      userId: user.id,
    });
    await expect(credentials.findTicket(eventTicket.token, 'job-events')).resolves.toBeUndefined();
    await expect(credentials.consumeTicket(setupTicket.token, 'initial-setup')).resolves.toEqual({ userId: null });
    await expect(credentials.consumeTicket(setupTicket.token, 'initial-setup')).resolves.toBeUndefined();
  });

  it('stores only the bootstrap token hash and accepts an injected seed', async () => {
    const first = await credentials.getOrCreateSetupToken('injected-setup-token');
    const second = await new AuthCredentialRepository(db).getOrCreateSetupToken('injected-setup-token');
    const stored = await db.selectFrom('auth_bootstrap').select('token_hash').executeTakeFirstOrThrow();

    expect(first).toBe('injected-setup-token');
    expect(second).toBe(first);
    expect(stored.token_hash).not.toBe(first);
    await expect(credentials.verifySetupToken(first!)).resolves.toBe(true);
    await expect(credentials.verifySetupToken('wrong-token')).resolves.toBe(false);

    await credentials.clearSetupToken();
    await expect(credentials.verifySetupToken(first!)).resolves.toBe(false);
  });

  it('exposes an automatically generated bootstrap token only to its creator', async () => {
    const first = await credentials.getOrCreateSetupToken();
    const second = await new AuthCredentialRepository(db).getOrCreateSetupToken();

    expect(first).toMatch(/^[a-f\d]{64}$/);
    expect(second).toBeUndefined();
    await expect(credentials.verifySetupToken(first!)).resolves.toBe(true);
  });

  it('keeps concurrently issued tickets valid', async () => {
    const user = await createUser();
    const sessionToken = await credentials.createSession(user.id);
    const session = await credentials.findSession(sessionToken);

    const tickets = await Promise.all([
      credentials.createTicket('activity-events', user.id, session!.id),
      credentials.createTicket('activity-events', user.id, session!.id),
    ]);
    const resolved = await Promise.all(tickets.map(({ token }) => credentials.findEventTicket(token)));

    expect(resolved.filter(Boolean)).toHaveLength(2);
  });

  it('bounds retained sessions and tickets', async () => {
    const user = await createUser();
    await Promise.all(Array.from({ length: 11 }, () => credentials.createSession(user.id)));
    const session = await db
      .selectFrom('auth_session')
      .select('id')
      .where('user_id', '=', user.id)
      .executeTakeFirstOrThrow();
    await Promise.all(
      Array.from({ length: 21 }, () => credentials.createTicket('activity-events', user.id, session.id)),
    );

    const sessions = await db.selectFrom('auth_session').select('id').where('user_id', '=', user.id).execute();
    const tickets = await db
      .selectFrom('auth_ticket')
      .select('token_hash')
      .where('session_id', '=', session.id)
      .where('scope', '=', 'activity-events')
      .execute();

    expect(sessions).toHaveLength(10);
    expect(tickets).toHaveLength(20);
  });

  it('rejects expired credentials', async () => {
    const user = await createUser();
    const sessionToken = await credentials.createSession(user.id);
    const session = await credentials.findSession(sessionToken);
    const ticket = await credentials.createTicket('activity-events', user.id, session!.id);
    await db
      .updateTable('auth_session')
      .set({ expires_at: new Date(0) })
      .execute();
    await db
      .updateTable('auth_ticket')
      .set({ expires_at: new Date(0) })
      .execute();

    await expect(credentials.findSession(sessionToken)).resolves.toBeUndefined();
    await expect(credentials.findTicket(ticket.token, 'activity-events')).resolves.toBeUndefined();
  });
});
