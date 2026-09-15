import { sql } from 'kysely';
import { BadRequestException } from 'src/errors';
import { hash, ScopeSchema, token, type Principal, type Scope } from 'src/mcp/context';
import type { KondisDatabase } from 'src/types';
import { z } from 'zod';

export const CreateKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(ScopeSchema).min(1).max(5),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});

export class ApiKeyService {
  constructor(private readonly db: KondisDatabase) {}

  async create(userId: string, input: z.infer<typeof CreateKeySchema>) {
    const parsed = CreateKeySchema.parse(input);
    const secret = `kondis_${token()}`;
    const digest = await hash(secret);
    const expiresAt = new Date(Date.now() + parsed.expiresInDays * 86_400_000);
    return this.db.transaction().execute(async (trx) => {
      await trx.selectFrom('user').select('id').where('id', '=', userId).forUpdate().executeTakeFirstOrThrow();
      const count = await sql<{
        count: number;
      }>`SELECT count(*)::int AS count FROM mcp_credential WHERE user_id = ${userId} AND revoked_at IS NULL AND expires_at > now()`.execute(
        trx,
      );
      if (count.rows[0].count >= 30) {
        throw new BadRequestException('Revoke an existing connection before creating another');
      }
      const result = await sql<{
        id: string;
      }>`INSERT INTO mcp_credential(user_id, name, kind, token_hash, scopes, expires_at) VALUES (${userId}, ${parsed.name}, 'key', ${digest}, ${[...new Set(parsed.scopes)]}, ${expiresAt}) RETURNING id`.execute(
        trx,
      );
      return { id: result.rows[0].id, secret, expiresAt: expiresAt.toISOString() };
    });
  }

  async list(userId: string) {
    const { rows } =
      await sql`SELECT id, name, kind, scopes, created_at AS "createdAt", last_used_at AS "lastUsedAt", expires_at AS "expiresAt", revoked_at AS "revokedAt" FROM mcp_credential WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`.execute(
        this.db,
      );
    return rows;
  }

  async revoke(userId: string, id: string) {
    await sql`UPDATE mcp_credential SET revoked_at = now(), refresh_hash = NULL WHERE user_id = ${userId} AND id = ${id}::uuid`.execute(
      this.db,
    );
  }

  async authenticate(secret: string, audience: string): Promise<Principal | undefined> {
    if (!/^kondis_[a-f0-9]{64}$/.test(secret)) {
      return;
    }
    const digest = await hash(secret);
    const { rows } = await sql<{ id: string; user_id: string; scopes: Scope[] }>`
      UPDATE mcp_credential SET last_used_at = now()
      WHERE token_hash = ${digest} AND revoked_at IS NULL AND expires_at > now()
        AND (kind = 'key' OR audience = ${audience})
      RETURNING id, user_id, scopes
    `.execute(this.db);
    const row = rows[0];
    return row && { userId: row.user_id, credentialId: row.id, scopes: new Set(row.scopes) };
  }
}
