import { sql } from 'kysely';
import type { KondisDatabase, KondisExecutor, KondisTransaction } from 'src/types';

export class McpOAuthRepository {
  constructor(private readonly db: KondisDatabase) {}

  createClient(id: string, name: string, redirectUris: string[]) {
    return this.db.insertInto('mcp_oauth_client').values({ id, name, redirect_uris: redirectUris }).executeTakeFirst();
  }

  findClient(id: string, executor: KondisExecutor = this.db) {
    return executor
      .selectFrom('mcp_oauth_client')
      .select(['name', 'redirect_uris'])
      .where('id', '=', id)
      .executeTakeFirst();
  }

  createCode(input: {
    hash: string;
    userId: string;
    clientId: string;
    redirectUri: string;
    challenge: string;
    audience: string;
    scopes: string[];
    expiresAt: Date;
  }) {
    return this.db
      .insertInto('mcp_oauth_code')
      .values({
        hash: input.hash,
        user_id: input.userId,
        client_id: input.clientId,
        redirect_uri: input.redirectUri,
        challenge: input.challenge,
        audience: input.audience,
        scopes: input.scopes,
        expires_at: input.expiresAt,
      })
      .executeTakeFirst();
  }

  consumeCode(
    input: { hash: string; clientId: string; redirectUri: string; challenge: string; audience: string },
    transaction: KondisTransaction,
  ) {
    return transaction
      .deleteFrom('mcp_oauth_code')
      .where('hash', '=', input.hash)
      .where('client_id', '=', input.clientId)
      .where('redirect_uri', '=', input.redirectUri)
      .where('challenge', '=', input.challenge)
      .where('audience', '=', input.audience)
      .where('expires_at', '>', new Date())
      .returning(['user_id', 'scopes'])
      .executeTakeFirst();
  }

  async deleteExpired(): Promise<void> {
    await Promise.all([
      this.db.deleteFrom('mcp_oauth_code').where('expires_at', '<=', new Date()).execute(),
      sql`DELETE FROM mcp_oauth_client c WHERE c.created_at < now() - interval '30 days' AND NOT EXISTS (SELECT 1 FROM mcp_credential k WHERE k.client_id = c.id AND k.revoked_at IS NULL AND (k.expires_at > now() OR k.refresh_expires_at > now()))`.execute(
        this.db,
      ),
    ]);
  }
}
