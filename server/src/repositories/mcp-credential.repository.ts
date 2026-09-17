import { sql } from 'kysely';
import type { KondisDatabase, KondisExecutor, KondisTransaction } from 'src/types';

export class McpCredentialRepository {
  constructor(private readonly db: KondisDatabase) {}

  lockOwner(userId: string, transaction: KondisTransaction) {
    return transaction.selectFrom('user').select('id').where('id', '=', userId).forUpdate().executeTakeFirstOrThrow();
  }

  async countActive(userId: string, executor: KondisExecutor): Promise<number> {
    const row = await executor
      .selectFrom('mcp_credential')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirstOrThrow();
    return row.count;
  }

  createKey(
    input: { userId: string; name: string; tokenHash: string; scopes: string[]; expiresAt: Date },
    transaction: KondisTransaction,
  ) {
    return transaction
      .insertInto('mcp_credential')
      .values({
        user_id: input.userId,
        name: input.name,
        kind: 'key',
        token_hash: input.tokenHash,
        refresh_hash: null,
        client_id: null,
        audience: null,
        scopes: input.scopes,
        expires_at: input.expiresAt,
        refresh_expires_at: null,
        revoked_at: null,
        last_used_at: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
  }

  list(userId: string) {
    return this.db
      .selectFrom('mcp_credential')
      .select(['id', 'name', 'kind', 'scopes', 'created_at', 'last_used_at', 'expires_at', 'revoked_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();
  }

  revoke(userId: string, id: string) {
    return this.db
      .updateTable('mcp_credential')
      .set({ revoked_at: new Date(), refresh_hash: null })
      .where('user_id', '=', userId)
      .where('id', '=', id)
      .execute();
  }

  authenticate(tokenHash: string, audience: string) {
    return this.db
      .updateTable('mcp_credential')
      .set({ last_used_at: new Date() })
      .where('token_hash', '=', tokenHash)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .where((eb) => eb.or([eb('kind', '=', 'key'), eb('audience', '=', audience)]))
      .returning(['id', 'user_id', 'scopes'])
      .executeTakeFirst();
  }

  rotateOAuth(
    input: {
      previousRefreshHash: string;
      accessHash: string;
      refreshHash: string;
      clientId: string;
      audience: string;
      expiresAt: Date;
    },
    transaction: KondisTransaction,
  ) {
    return transaction
      .updateTable('mcp_credential')
      .set({ token_hash: input.accessHash, refresh_hash: input.refreshHash, expires_at: input.expiresAt })
      .where('refresh_hash', '=', input.previousRefreshHash)
      .where('client_id', '=', input.clientId)
      .where('audience', '=', input.audience)
      .where('revoked_at', 'is', null)
      .where('refresh_expires_at', '>', new Date())
      .returning('scopes')
      .executeTakeFirst();
  }

  createOAuth(
    input: {
      userId: string;
      name: string;
      accessHash: string;
      refreshHash: string;
      clientId: string;
      audience: string;
      scopes: string[];
      expiresAt: Date;
      refreshExpiresAt: Date;
    },
    transaction: KondisTransaction,
  ) {
    return transaction
      .insertInto('mcp_credential')
      .values({
        user_id: input.userId,
        name: input.name,
        kind: 'oauth',
        token_hash: input.accessHash,
        refresh_hash: input.refreshHash,
        client_id: input.clientId,
        audience: input.audience,
        scopes: input.scopes,
        expires_at: input.expiresAt,
        refresh_expires_at: input.refreshExpiresAt,
        revoked_at: null,
        last_used_at: null,
      })
      .executeTakeFirst();
  }

  revokeOAuth(clientId: string, tokenHash: string) {
    return this.db
      .updateTable('mcp_credential')
      .set({ revoked_at: new Date(), refresh_hash: null })
      .where('client_id', '=', clientId)
      .where((eb) => eb.or([eb('token_hash', '=', tokenHash), eb('refresh_hash', '=', tokenHash)]))
      .execute();
  }
}
