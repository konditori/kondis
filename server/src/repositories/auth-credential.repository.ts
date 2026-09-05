import { sql } from 'kysely';
import type { AuthenticatedUser } from 'src/auth';
import type { AuthTicketScope } from 'src/schema/tables/auth-ticket.table';
import type { KondisDatabase, KondisExecutor } from 'src/types';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60_000;
const SESSION_TOUCH_INTERVAL_MS = 60 * 60_000;
const MAX_ACTIVE_SESSIONS_PER_USER = 10;
const MAX_ACTIVE_TICKETS_PER_OWNER_SCOPE = 20;
const TICKET_LIFETIMES_MS: Record<AuthTicketScope, number> = {
  'activity-events': 60_000,
  'initial-setup': 10 * 60_000,
  'job-events': 60_000,
};
const TOKEN_PATTERN = /^[a-f\d]{64}$/;

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const createToken = (): string => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));

const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
};

export type AuthenticatedSession = {
  id: string;
  user: AuthenticatedUser;
};

export class AuthCredentialRepository {
  constructor(private readonly db: KondisDatabase) {}

  async createSession(userId: string, executor: KondisExecutor = this.db): Promise<string> {
    const token = createToken();
    const tokenHash = await hashToken(token);
    const insert = async (transaction: KondisExecutor) => {
      await transaction.selectFrom('user').select('id').where('id', '=', userId).forUpdate().executeTakeFirstOrThrow();
      await transaction
        .insertInto('auth_session')
        .values({ token_hash: tokenHash, user_id: userId, expires_at: new Date(Date.now() + SESSION_LIFETIME_MS) })
        .executeTakeFirstOrThrow();
      await sql`
        DELETE FROM auth_session
        WHERE id IN (
          SELECT id FROM auth_session
          WHERE user_id = ${userId}
          ORDER BY created_at DESC, id DESC
          OFFSET ${MAX_ACTIVE_SESSIONS_PER_USER}
        )
      `.execute(transaction);
    };
    if (executor === this.db) {
      await this.db.transaction().execute(insert);
    } else {
      await insert(executor);
    }
    return token;
  }

  async getOrCreateSetupToken(preferredToken?: string): Promise<string | undefined> {
    if (preferredToken && (preferredToken.length < 32 || preferredToken.length > 512)) {
      throw new Error('KONDIS_SETUP_TOKEN must contain between 32 and 512 characters');
    }
    const token = preferredToken || createToken();
    const tokenHash = await hashToken(token);
    let insert = this.db.insertInto('auth_bootstrap').values({ token_hash: tokenHash });
    insert = preferredToken
      ? insert.onConflict((conflict) => conflict.column('id').doUpdateSet({ token_hash: tokenHash }))
      : insert.onConflict((conflict) => conflict.column('id').doNothing());
    const inserted = await insert.returning('id').executeTakeFirst();
    return inserted ? token : undefined;
  }

  async verifySetupToken(token: string): Promise<boolean> {
    if (token.length === 0 || token.length > 512) {
      return false;
    }
    const bootstrap = await this.db
      .selectFrom('auth_bootstrap')
      .select('id')
      .where('token_hash', '=', await hashToken(token))
      .executeTakeFirst();
    return Boolean(bootstrap);
  }

  async clearSetupToken(executor: KondisExecutor = this.db): Promise<void> {
    await executor.deleteFrom('auth_bootstrap').execute();
  }

  async consumeSetupBootstrap(executor: KondisExecutor): Promise<boolean> {
    const bootstrap = await executor.deleteFrom('auth_bootstrap').returning('id').executeTakeFirst();
    return Boolean(bootstrap);
  }

  async clearSetupTickets(executor: KondisExecutor): Promise<void> {
    await executor.deleteFrom('auth_ticket').where('scope', '=', 'initial-setup').execute();
  }

  async findSession(token: string): Promise<AuthenticatedSession | undefined> {
    if (!TOKEN_PATTERN.test(token)) {
      return undefined;
    }
    const tokenHash = await hashToken(token);
    const session = await this.db
      .selectFrom('auth_session')
      .innerJoin('user', 'user.id', 'auth_session.user_id')
      .select([
        'auth_session.id as session_id',
        'auth_session.last_seen_at',
        'user.id',
        'user.email',
        'user.role',
        'user.first_name',
        'user.last_name',
      ])
      .where('auth_session.token_hash', '=', tokenHash)
      .where('auth_session.expires_at', '>', new Date())
      .executeTakeFirst();
    if (!session) {
      return undefined;
    }

    if (new Date(session.last_seen_at).getTime() < Date.now() - SESSION_TOUCH_INTERVAL_MS) {
      await this.db
        .updateTable('auth_session')
        .set({ last_seen_at: new Date() })
        .where('id', '=', session.session_id)
        .execute();
    }

    return {
      id: session.session_id,
      user: {
        id: session.id,
        email: session.email,
        role: session.role,
        firstName: session.first_name,
        lastName: session.last_name,
      },
    };
  }

  async revokeSession(id: string): Promise<void> {
    await this.db.deleteFrom('auth_session').where('id', '=', id).execute();
  }

  async createTicket(scope: AuthTicketScope, userId: string | null = null, sessionId: string | null = null) {
    const token = createToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + TICKET_LIFETIMES_MS[scope]);
    await this.db.transaction().execute(async (transaction) => {
      if (sessionId) {
        await transaction
          .selectFrom('auth_session')
          .select('id')
          .where('id', '=', sessionId)
          .forUpdate()
          .executeTakeFirstOrThrow();
      } else {
        await transaction.selectFrom('auth_bootstrap').select('id').forUpdate().executeTakeFirstOrThrow();
      }
      await transaction
        .insertInto('auth_ticket')
        .values({ token_hash: tokenHash, user_id: userId, session_id: sessionId, scope, expires_at: expiresAt })
        .executeTakeFirstOrThrow();
      await sql`
        DELETE FROM auth_ticket
        WHERE token_hash IN (
          SELECT token_hash FROM auth_ticket
          WHERE scope = ${scope} AND session_id IS NOT DISTINCT FROM ${sessionId}
          ORDER BY created_at DESC, token_hash DESC
          OFFSET ${MAX_ACTIVE_TICKETS_PER_OWNER_SCOPE}
        )
      `.execute(transaction);
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async findTicket(token: string | null, scope: AuthTicketScope): Promise<{ userId: string | null } | undefined> {
    if (!token) {
      return undefined;
    }
    if (!TOKEN_PATTERN.test(token)) {
      return undefined;
    }
    const tokenHash = await hashToken(token);
    const ticket = await this.db
      .selectFrom('auth_ticket')
      .select('user_id')
      .where('token_hash', '=', tokenHash)
      .where('scope', '=', scope)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();
    return ticket ? { userId: ticket.user_id } : undefined;
  }

  async findEventTicket(
    token: string | null,
  ): Promise<{ scope: 'activity-events' | 'job-events'; sessionId: string; userId: string | null } | undefined> {
    if (!token || !TOKEN_PATTERN.test(token)) {
      return undefined;
    }
    const ticket = await this.db
      .selectFrom('auth_ticket')
      .innerJoin('auth_session', 'auth_session.id', 'auth_ticket.session_id')
      .select(['auth_ticket.scope', 'auth_ticket.session_id'])
      .select('auth_ticket.user_id')
      .where('auth_ticket.token_hash', '=', await hashToken(token))
      .where('auth_ticket.scope', 'in', ['activity-events', 'job-events'])
      .where('auth_ticket.expires_at', '>', new Date())
      .where('auth_session.expires_at', '>', new Date())
      .executeTakeFirst();
    return ticket && ticket.scope !== 'initial-setup' && ticket.session_id
      ? { scope: ticket.scope, sessionId: ticket.session_id, userId: ticket.user_id }
      : undefined;
  }

  async findActiveSessionIds(sessionIds: string[]): Promise<Set<string>> {
    if (sessionIds.length === 0) {
      return new Set();
    }
    const sessions = await this.db
      .selectFrom('auth_session')
      .select('id')
      .where('id', 'in', sessionIds)
      .where('expires_at', '>', new Date())
      .execute();
    return new Set(sessions.map(({ id }) => id));
  }

  async consumeTicket(
    token: string,
    scope: AuthTicketScope,
    executor: KondisExecutor = this.db,
  ): Promise<{ userId: string | null } | undefined> {
    if (!TOKEN_PATTERN.test(token)) {
      return undefined;
    }
    const tokenHash = await hashToken(token);
    const ticket = await executor
      .deleteFrom('auth_ticket')
      .where('token_hash', '=', tokenHash)
      .where('scope', '=', scope)
      .where('expires_at', '>', new Date())
      .returning('user_id')
      .executeTakeFirst();
    return ticket ? { userId: ticket.user_id } : undefined;
  }

  async deleteExpired(): Promise<void> {
    await Promise.all([
      this.db.deleteFrom('auth_session').where('expires_at', '<=', new Date()).execute(),
      this.db.deleteFrom('auth_ticket').where('expires_at', '<=', new Date()).execute(),
      this.db
        .deleteFrom('auth_rate_limit')
        .where('window_started_at', '<=', new Date(Date.now() - 24 * 60 * 60_000))
        .execute(),
    ]);
  }
}
